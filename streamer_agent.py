"""
Local mic → faster-whisper (GPU) → HTTPS POST to SweetFlips STT relay (final transcripts).
OBS WebSocket (optional) toggles transcription when stream starts/stops.
Process stays up 24/7; outbound-only (no inbound ports).
"""

from __future__ import annotations

import os as _os_early
import sys as _sys_early
from pathlib import Path

if _sys_early.platform == "win32":
    _sys_early.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    _sys_early.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]

for _k, _v in (("OMP_NUM_THREADS", "4"), ("MKL_NUM_THREADS", "4"), ("OPENBLAS_NUM_THREADS", "4")):
    _os_early.environ.setdefault(_k, _v)

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

import asyncio
import json
import logging
import os
from contextlib import suppress
import queue
import re
import signal
import sys
import threading
import time
from dataclasses import dataclass
from typing import Any

import httpx
import numpy as np
import sounddevice as sd
from faster_whisper import WhisperModel

from emotion_laughter import enrich_utterance
from stt_audio_devices import (
    default_input_device_index,
    is_likely_desktop_capture,
    prefer_default_when_duplicate,
    print_input_devices,
)
from transcript_normalization import normalize_brand_transcript
from stt_single_instance import acquire_streamer_lock

log = logging.getLogger("stt.streamer")
_dropped_ingest_total = [0]

_transcription_live = threading.Event()
_transcription_live.set()

_obs_req_client: Any = None


def _setup_logging() -> None:
    level_name = os.environ.get("STT_LOG_LEVEL", "INFO").strip().upper()
    level = getattr(logging, level_name, logging.INFO)
    if os.environ.get("STT_LOG_JSON", "").strip().lower() in ("1", "true", "yes", "on"):

        class _JsonFormatter(logging.Formatter):
            def format(self, record: logging.LogRecord) -> str:
                payload = {
                    "level": record.levelname,
                    "message": record.getMessage(),
                    "logger": record.name,
                    "time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)),
                }
                if record.exc_info:
                    payload["exc_info"] = self.formatException(record.exc_info)
                return json.dumps(payload, ensure_ascii=False)

        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(_JsonFormatter())
        root = logging.getLogger()
        root.handlers.clear()
        root.addHandler(handler)
        root.setLevel(level)
    else:
        root = logging.getLogger()
        root.handlers.clear()
        logging.basicConfig(
            level=level,
            format="%(asctime)s %(levelname)s [stt.streamer] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
            stream=sys.stderr,
            force=True,
        )
    log.setLevel(level)


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError as e:
        raise SystemExit(f"Invalid integer for {name}={raw!r}: {e}") from e


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError as e:
        raise SystemExit(f"Invalid float for {name}={raw!r}: {e}") from e


_setup_logging()

RELAY_URL = os.environ.get("STT_RELAY_URL", "https://stt.sweetflips.ai").strip().rstrip("/")
SOURCE_NAME = os.environ.get("STT_SOURCE_NAME", "streamer-pc").strip() or "streamer-pc"

INPUT_DEVICE_INDEX: int | None = None
INPUT_DEVICE_EXACT_NAME = "Microfoon (NVIDIA Broadcast)"

SAMPLE_RATE = 16000
CHANNELS = 1
BLOCKSIZE = 1600

MODEL_SIZE = os.environ.get("STT_MODEL", "").strip() or "large-v3"
DEVICE = "cuda"
COMPUTE_TYPE = os.environ.get("STT_COMPUTE_TYPE", "").strip() or "float16"

STT_CPU_THREADS = _env_int("STT_CPU_THREADS", 4)
STT_NUM_WORKERS = _env_int("STT_NUM_WORKERS", 1)

RMS_THRESHOLD = 0.018
MIN_SPEECH_SECONDS = 0.35
END_SILENCE_SECONDS = 0.35
MAX_SEGMENT_SECONDS = 8.0

FINAL_BEAM_SIZE = _env_int("STT_BEAM_SIZE", 1)


def get_stt_language() -> str | None:
    raw = os.environ.get("STT_LANGUAGE", "en")
    v = raw.strip().lower()
    if v in ("auto", "detect", "multi"):
        return None
    if not v:
        return "en"
    return v


def get_stt_multilingual() -> bool:
    return os.environ.get("STT_MULTILINGUAL", "0").strip().lower() not in (
        "0",
        "false",
        "no",
        "off",
    )


VAD_FILTER = True
VAD_THRESHOLD = 0.62
VAD_MIN_SPEECH_MS = 280

BANNED_UTTERANCES = frozenset(
    {
        "thanks for watching",
        "thank you for watching",
        "bye",
        "mmm",
        "mm-hmm",
        "uh",
        "um",
    }
)

THANK_YOU_GRATITUDE_PHRASES = frozenset(
    {
        "thank you",
        "thanks",
        "thank you very much",
        "thank you so much",
        "thanks a lot",
        "thanks so much",
    }
)


def _thank_you_keep_max_avg_no_speech_prob() -> float:
    return _env_float("STT_THANK_YOU_KEEP_MAX_AVG_NO_SPEECH_PROB", 0.28)


def _drop_if_avg_no_speech_above() -> float:
    return _env_float("STT_DROP_IF_AVG_NO_SPEECH_ABOVE", 0.38)


def _drop_if_max_no_speech_above() -> float:
    return _env_float("STT_DROP_IF_MAX_NO_SPEECH_ABOVE", 0.82)


HALLUCINATION_MAX_SECONDS = 1.1
HALLUCINATION_PHRASES_SHORT = frozenset(
    {
        "thanks for watching",
        "thank you for watching",
        "bye",
        "mmm",
        "mm-hmm",
        "uh",
        "um",
    }
)

POST_MAX_RETRIES = _env_int("STT_HTTP_POST_MAX_RETRIES", 5)
POST_BACKOFF_MAX_S = _env_float("STT_HTTP_POST_BACKOFF_MAX_S", 30.0)
HTTP_TIMEOUT_S = _env_float("STT_HTTP_TIMEOUT_S", 10.0)
AUDIO_QUEUE_MAX_CHUNKS = _env_int("STT_AUDIO_QUEUE_MAX_CHUNKS", 200)
AUDIO_QUEUE_LOG_EVERY = 25

SEND_ALL_TRANSCRIPTS = os.environ.get("STT_SEND_ALL_TRANSCRIPTS", "").strip().lower() in (
    "1",
    "true",
    "yes",
    "on",
)

OBS_POLL_INTERVAL_S = _env_float("OBS_POLL_INTERVAL_S", 1.0)


def _print_relay_banner() -> None:
    log.info(
        "Relay HTTPS: %s -> POST /source/online, /source/offline, /ingest (source=%s)",
        RELAY_URL,
        SOURCE_NAME,
    )


def effective_input_device_exact_name() -> str:
    env = os.environ.get("STT_INPUT_DEVICE_EXACT_NAME", "").strip()
    return env if env else INPUT_DEVICE_EXACT_NAME


def mic_exact_name_candidates() -> list[str]:
    explicit = os.environ.get("STT_INPUT_DEVICE_EXACT_NAME", "").strip()
    if explicit:
        return [explicit]
    if os.environ.get("STT_NVIDIA_BROADCAST_MIC_ONLY", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    ):
        return [
            "Microphone (NVIDIA Broadcast)",
            "Microfoon (NVIDIA Broadcast)",
        ]
    return [INPUT_DEVICE_EXACT_NAME]


def effective_input_device_index() -> int | None:
    raw = os.environ.get("STT_INPUT_DEVICE_INDEX", "").strip()
    if raw:
        try:
            return int(raw)
        except ValueError as e:
            raise SystemExit(f"Invalid integer for STT_INPUT_DEVICE_INDEX={raw!r}: {e}") from e
    return INPUT_DEVICE_INDEX


def index_from_env_only() -> bool:
    return bool(os.environ.get("STT_INPUT_DEVICE_INDEX", "").strip())


@dataclass
class AudioChunk:
    samples: np.ndarray
    ts: float


audio_queue: queue.Queue[AudioChunk] = queue.Queue(maxsize=AUDIO_QUEUE_MAX_CHUNKS)
_dropped_audio_chunks = 0


def _enqueue_audio_chunk(chunk: AudioChunk) -> None:
    global _dropped_audio_chunks

    try:
        audio_queue.put_nowait(chunk)
        return
    except queue.Full:
        pass

    try:
        audio_queue.get_nowait()
    except queue.Empty:
        pass

    try:
        audio_queue.put_nowait(chunk)
    except queue.Full:
        pass

    _dropped_audio_chunks += 1
    if _dropped_audio_chunks == 1 or _dropped_audio_chunks % AUDIO_QUEUE_LOG_EVERY == 0:
        log.warning(
            "Audio queue overflow; dropped %d chunks (max %d)",
            _dropped_audio_chunks,
            AUDIO_QUEUE_MAX_CHUNKS,
        )


def _warn_if_nvidia_broadcast_may_mix_music(dev_name: str) -> None:
    n = (dev_name or "").lower()
    if "nvidia" in n and "broadcast" in n:
        log.warning(
            "NVIDIA Broadcast may mix desktop/music into this stream. "
            "In NVIDIA Broadcast: turn off system/desktop audio capture, or pick a "
            "physical mic (STT_INPUT_DEVICE_EXACT_NAME / STT_INPUT_DEVICE_INDEX; "
            "list: STT_LIST_DEVICES=1)."
        )


def resolve_input_device_hard_lock() -> int:
    devices = sd.query_devices()
    idx_override = effective_input_device_index()

    if idx_override is not None:
        want = effective_input_device_exact_name().strip()
        idx = idx_override
        if idx < 0 or idx >= len(devices):
            raise SystemExit(f"[HARD LOCK] Invalid INPUT_DEVICE_INDEX: {idx}")
        dev = devices[idx]
        if int(dev["max_input_channels"]) <= 0:
            raise SystemExit(f"[HARD LOCK] Device {idx} is not an input: {dev['name']!r}")
        got = dev["name"].strip()
        if not index_from_env_only() and got != want:
            raise SystemExit(
                f"[HARD LOCK] Index {idx} is {got!r}, expected exact name {want!r}. "
                "Fix INPUT_DEVICE_INDEX or INPUT_DEVICE_EXACT_NAME, or set "
                "STT_INPUT_DEVICE_INDEX / STT_INPUT_DEVICE_EXACT_NAME in .env"
            )
        if is_likely_desktop_capture(got):
            raise SystemExit(
                f"[HARD LOCK] Device {idx} is treated as desktop/speaker capture: {got!r}. "
                "Pick your microphone index from the list (STT_LIST_DEVICES=1). "
                "To force anyway: STT_ALLOW_DESKTOP_CAPTURE=1"
            )
        _warn_if_nvidia_broadcast_may_mix_music(got)
        return idx

    candidates = mic_exact_name_candidates()
    want = ""
    matches: list[int] = []
    for cand in candidates:
        m = [
            i
            for i, dev in enumerate(devices)
            if int(dev["max_input_channels"]) > 0 and dev["name"].strip() == cand
        ]
        if m:
            want = cand
            matches = m
            if len(candidates) > 1:
                log.info("Mic selected: %r (candidates: %s)", want, candidates)
            break
    if not matches:
        log.error("No input device for name(s) %r", candidates)
        log.info("Available input devices:")
        print_input_devices()
        raise SystemExit(1)
    if len(matches) > 1:
        default_in = default_input_device_index()
        if (
            prefer_default_when_duplicate()
            and default_in is not None
            and default_in in matches
        ):
            idx = default_in
            log.info(
                "Multiple inputs named %r: indices %s. Using Windows default recording device = %s "
                "(STT_PREFER_DEVICE_DEFAULT=1).",
                want,
                matches,
                idx,
            )
        else:
            idx = matches[0]
            log.info(
                "Multiple inputs named %r: indices %s. Using index %s (first). Set STT_INPUT_DEVICE_INDEX "
                "or align Windows default recording to your mic; or STT_PREFER_DEVICE_DEFAULT=1.",
                want,
                matches,
                idx,
            )
    else:
        idx = matches[0]

    dev_name = devices[idx]["name"].strip()
    if is_likely_desktop_capture(dev_name):
        raise SystemExit(
            f"[HARD LOCK] Resolved device looks like desktop/speaker capture: {dev_name!r}. "
            "Use a microphone name/index. Run with STT_LIST_DEVICES=1. "
            "Override: STT_ALLOW_DESKTOP_CAPTURE=1"
        )
    _warn_if_nvidia_broadcast_may_mix_music(dev_name)
    return idx


def audio_callback(indata, frames, time_info, status):
    if status:
        log.debug("Audio status: %s", status)
    if not _transcription_live.is_set():
        return
    mono = np.squeeze(indata.copy())
    _enqueue_audio_chunk(AudioChunk(samples=mono.astype(np.float32), ts=time.time()))


def rms(x: np.ndarray) -> float:
    if x.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(np.square(x), dtype=np.float64)))


class RelayClient:
    """Outbound HTTPS to relay; retries with exponential backoff."""

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(timeout=HTTP_TIMEOUT_S)
        self._last_sent_utterance_id: int | None = None

    async def post(self, path: str, payload: dict) -> bool:
        url = f"{RELAY_URL}{path}"
        attempts = 0
        backoff = 1.0
        while attempts < POST_MAX_RETRIES:
            try:
                r = await self._client.post(url, json=payload)
                if r.status_code < 300:
                    return True
                log.warning("relay %s returned %s", path, r.status_code)
            except httpx.HTTPError as e:
                log.warning("relay %s failed: %s (attempt %d)", path, e, attempts + 1)
            attempts += 1
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, POST_BACKOFF_MAX_S)
        log.error("relay %s: gave up after %d attempts", path, attempts)
        return False

    async def source_online(self) -> bool:
        return await self.post("/source/online", {"source_name": SOURCE_NAME})

    async def source_offline(self) -> bool:
        return await self.post("/source/offline", {"source_name": SOURCE_NAME})

    async def ingest(self, text: str, ts: float, utterance_id: int | None) -> bool:
        if utterance_id is not None and utterance_id == self._last_sent_utterance_id:
            log.debug("skip duplicate ingest utterance_id=%s", utterance_id)
            return True
        ok = await self.post(
            "/ingest",
            {
                "type": "transcript",
                "text": text,
                "is_final": True,
                "timestamp": ts,
                "source": SOURCE_NAME,
            },
        )
        if ok and utterance_id is not None:
            self._last_sent_utterance_id = utterance_id
        elif not ok:
            _dropped_ingest_total[0] += 1
            log.error("ingest failed (total dropped=%d)", _dropped_ingest_total[0])
        return ok

    async def close(self) -> None:
        await self._client.aclose()


class SpeechSegmenter:
    """Energy VAD: buffer until silence or max segment length."""

    def __init__(self):
        self._in_speech = False
        self._speech_start_ts: float | None = None
        self._last_loud_ts: float | None = None
        self._buf: list[np.ndarray] = []
        self.utterance_id = 0

    def push(self, chunk: AudioChunk) -> np.ndarray | None:
        now = chunk.ts
        level = rms(chunk.samples)
        loud = level >= RMS_THRESHOLD

        if not self._in_speech:
            if loud:
                self.utterance_id += 1
                self._in_speech = True
                self._speech_start_ts = now
                self._last_loud_ts = now
                self._buf = [chunk.samples.copy()]
            return None

        self._buf.append(chunk.samples.copy())
        if loud:
            self._last_loud_ts = now

        if self._speech_start_ts is None or self._last_loud_ts is None:
            return None

        duration = now - self._speech_start_ts
        silence = now - self._last_loud_ts

        too_long = duration >= MAX_SEGMENT_SECONDS
        end_silence = silence >= END_SILENCE_SECONDS and duration >= MIN_SPEECH_SECONDS

        if too_long or end_silence:
            seg = np.concatenate(self._buf, axis=0).astype(np.float32)
            self._in_speech = False
            self._speech_start_ts = None
            self._last_loud_ts = None
            self._buf = []
            if seg.size / SAMPLE_RATE < MIN_SPEECH_SECONDS and not too_long:
                return None
            return seg

        return None


def _queue_get_timeout(timeout: float) -> AudioChunk:
    return audio_queue.get(timeout=timeout)


async def get_chunk(stop: asyncio.Event) -> AudioChunk | None:
    while not stop.is_set():
        try:
            return await asyncio.to_thread(_queue_get_timeout, 0.25)
        except queue.Empty:
            continue
    return None


def obs_get_stream_active() -> bool | None:
    """True/False from OBS; None if OBS disabled, import failed, or unreachable (default: transcribe)."""
    global _obs_req_client
    if os.environ.get("OBS_WS_ENABLED", "1").strip().lower() in ("0", "false", "no", "off"):
        return None
    try:
        from obsws_python import ReqClient
    except ImportError:
        log.info("obsws-python not installed; transcribing always (install obsws-python for OBS control)")
        return None
    if _obs_req_client is None:
        try:
            _obs_req_client = ReqClient(
                host=os.environ.get("OBS_WS_HOST", "localhost"),
                port=int(os.environ.get("OBS_WS_PORT", "4455")),
                password=os.environ.get("OBS_WS_PASSWORD", ""),
                timeout=5,
            )
        except Exception as e:
            log.debug("OBS ReqClient init failed: %s", e)
            return None
    try:
        r = _obs_req_client.get_stream_status()
        oa = getattr(r, "output_active", None)
        if oa is None:
            oa = getattr(r, "outputActive", None)
        if oa is None and isinstance(r, dict):
            oa = r.get("outputActive") or r.get("output_active")
        if oa is None:
            return None
        return bool(oa)
    except Exception as e:
        log.debug("OBS get_stream_status failed: %s", e)
        _obs_req_client = None
        return None


async def obs_poll_loop(
    stop: asyncio.Event, relay: RelayClient, segmenter_box: list[SpeechSegmenter]
) -> None:
    prev: bool | None = None
    online_announced = False
    while not stop.is_set():
        active = await asyncio.to_thread(obs_get_stream_active)
        if active is None:
            _transcription_live.set()
            if prev is False:
                segmenter_box[0] = SpeechSegmenter()
                await relay.source_online()
                online_announced = True
            elif not online_announced:
                await relay.source_online()
                online_announced = True
            prev = None
        elif active:
            _transcription_live.set()
            if prev is not True:
                if prev is False:
                    segmenter_box[0] = SpeechSegmenter()
                await relay.source_online()
                online_announced = True
            prev = True
        else:
            _transcription_live.clear()
            if prev is not False:
                segmenter_box[0] = SpeechSegmenter()
                await relay.source_offline()
                online_announced = False
            prev = False
        await asyncio.sleep(OBS_POLL_INTERVAL_S)


def _normalize_phrase(t: str) -> str:
    return " ".join(t.lower().strip().rstrip(".!?").split())


def _join_whisper_segments_text(segments: list) -> str:
    parts: list[str] = []
    prev_norm: str | None = None
    for s in segments:
        t = getattr(s, "text", "") or ""
        if not t.strip():
            continue
        n = _normalize_phrase(t)
        if prev_norm is not None and n == prev_norm:
            continue
        parts.append(t)
        prev_norm = n
    return "".join(parts).strip()


def _strip_duplicate_full_utterance(text: str) -> str:
    t = text.strip()
    if len(t) < 2:
        return t
    half = len(t) // 2
    if half >= 1 and t[:half].strip() == t[half:].strip():
        return t[:half].strip()
    parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+", t) if p.strip()]
    if len(parts) == 2 and _normalize_phrase(parts[0]) == _normalize_phrase(parts[1]):
        return parts[0]
    return t


def should_drop_utterance(text: str, audio_seconds: float) -> bool:
    n = _normalize_phrase(text)
    if not n:
        return True
    if n in BANNED_UTTERANCES:
        return True
    if audio_seconds <= HALLUCINATION_MAX_SECONDS and n in HALLUCINATION_PHRASES_SHORT:
        return True
    return False


def should_drop_likely_no_speech(text: str, whisper_segments: list) -> bool:
    if not text.strip():
        return True
    if not whisper_segments:
        return True
    avg_nsp = sum(s.no_speech_prob for s in whisper_segments) / len(whisper_segments)
    avg_log = sum(s.avg_logprob for s in whisper_segments) / len(whisper_segments)
    max_nsp = max(s.no_speech_prob for s in whisper_segments)
    max_cr = max(s.compression_ratio for s in whisper_segments)
    if max_cr >= 2.75:
        return True
    if max_nsp >= _drop_if_max_no_speech_above():
        return True
    if avg_nsp >= _drop_if_avg_no_speech_above():
        return True
    if avg_nsp >= 0.26 and avg_log < -0.62:
        return True
    return False


def should_drop_thank_you_hallucination(text: str, whisper_segments: list, audio_seconds: float) -> bool:
    n = _normalize_phrase(text)
    if n not in THANK_YOU_GRATITUDE_PHRASES:
        return False
    if not whisper_segments:
        return True
    avg_nsp = sum(s.no_speech_prob for s in whisper_segments) / len(whisper_segments)
    keep_below = _thank_you_keep_max_avg_no_speech_prob()
    if avg_nsp < keep_below:
        return False
    return True


def transcribe_sync(
    model: WhisperModel, audio: np.ndarray, *, beam_size: int
) -> tuple[str, list, Any]:
    vad_parameters = {
        "threshold": VAD_THRESHOLD,
        "min_speech_duration_ms": VAD_MIN_SPEECH_MS,
        "min_silence_duration_ms": 400,
    }
    lang = get_stt_language()
    multilingual = lang is None and get_stt_multilingual()
    try:
        segments, info = model.transcribe(
            audio,
            language=lang,
            task="transcribe",
            multilingual=multilingual,
            vad_filter=VAD_FILTER,
            vad_parameters=vad_parameters,
            beam_size=beam_size,
            condition_on_previous_text=False,
            repetition_penalty=1.15,
            no_repeat_ngram_size=3,
            no_speech_threshold=0.68,
            log_prob_threshold=-0.32,
        )
    except Exception as e:
        log.exception("Whisper transcribe failed: %s", e)
        return "", [], None
    segs = list(segments)
    text = _join_whisper_segments_text(segs)
    text = _strip_duplicate_full_utterance(text)
    return text, segs, info


def _segment_metrics(segs: list) -> dict[str, Any]:
    if not segs:
        return {
            "avg_logprob": 0.0,
            "no_speech_prob": 1.0,
            "compression_ratio": 1.0,
            "segment_count": 0,
            "confidence": 0.0,
        }
    n = len(segs)
    avg_lp = sum(s.avg_logprob for s in segs) / n
    avg_nsp = sum(s.no_speech_prob for s in segs) / n
    avg_cr = sum(s.compression_ratio for s in segs) / n
    confidence = max(0.0, min(1.0, (1.0 - avg_nsp) * min(1.0, 1.0 + avg_lp / 0.5)))
    return {
        "avg_logprob": round(avg_lp, 4),
        "no_speech_prob": round(avg_nsp, 4),
        "compression_ratio": round(avg_cr, 3),
        "segment_count": n,
        "confidence": round(confidence, 3),
    }


def _language_payload(info: Any) -> dict[str, Any]:
    if info is None:
        return {"language": "und", "language_probability": 0.0}
    lang = getattr(info, "language", None)
    out: dict[str, Any] = {
        "language": (lang if isinstance(lang, str) and lang.strip() else "und"),
        "language_probability": round(float(getattr(info, "language_probability", 0.0)), 4),
    }
    probs = getattr(info, "all_language_probs", None)
    if probs:
        out["language_alternatives"] = [
            {"code": c, "probability": round(float(p), 4)} for c, p in probs[:10]
        ]
    return out


async def transcribe_and_stream(stop: asyncio.Event) -> None:
    device_index = resolve_input_device_hard_lock()
    dev_name = sd.query_devices(device_index)["name"]
    log.info("HARD LOCK input: [%s] %s", device_index, dev_name)

    log.info(
        "Loading Whisper model %s (%s, %s) cpu_threads=%s beam=%s workers=%s...",
        MODEL_SIZE,
        DEVICE,
        COMPUTE_TYPE,
        STT_CPU_THREADS,
        FINAL_BEAM_SIZE,
        STT_NUM_WORKERS,
    )
    try:
        model = WhisperModel(
            MODEL_SIZE,
            device=DEVICE,
            compute_type=COMPUTE_TYPE,
            cpu_threads=STT_CPU_THREADS,
            num_workers=STT_NUM_WORKERS,
        )
    except Exception as e:
        log.exception(
            "Failed to load Whisper model %s on %s (%s). Check CUDA, VRAM, and STT_COMPUTE_TYPE.",
            MODEL_SIZE,
            DEVICE,
            COMPUTE_TYPE,
        )
        raise SystemExit(1) from e

    log.info("Model ready.")
    _lg = get_stt_language()
    _ml = _lg is None and get_stt_multilingual()
    log.info(
        "Language: %s; multilingual per segment: %s",
        "auto (detect per utterance)" if _lg is None else _lg,
        "on" if _ml else "off",
    )
    _print_relay_banner()
    log.info("Source name: %s", SOURCE_NAME)

    relay = RelayClient()

    segmenter_box: list[SpeechSegmenter] = [SpeechSegmenter()]

    obs_task = asyncio.create_task(obs_poll_loop(stop, relay, segmenter_box))

    try:
        with sd.InputStream(
            device=device_index,
            channels=CHANNELS,
            samplerate=SAMPLE_RATE,
            blocksize=BLOCKSIZE,
            dtype="float32",
            callback=audio_callback,
        ):
            log.info("Final transcripts via POST /ingest (no partials). Ctrl+C or SIGTERM to stop.")
            while not stop.is_set():
                chunk = await get_chunk(stop)
                if chunk is None:
                    break

                seg = segmenter_box[0]
                final = seg.push(chunk)
                if final is None or final.size == 0:
                    continue

                buf_rms = rms(final)
                if buf_rms < _env_float("STT_MIN_BUFFER_RMS", 0.014):
                    continue

                text, whisper_segs, whisper_info = await asyncio.to_thread(
                    transcribe_sync, model, final, beam_size=FINAL_BEAM_SIZE
                )
                if not text:
                    continue

                text = normalize_brand_transcript(text)

                dur = float(final.size) / SAMPLE_RATE
                if not SEND_ALL_TRANSCRIPTS:
                    if should_drop_likely_no_speech(text, whisper_segs):
                        log.debug(
                            "[SKIP no-speech model] (%.2fs) rms=%.4f %r",
                            dur,
                            buf_rms,
                            text,
                        )
                        continue
                    if should_drop_thank_you_hallucination(text, whisper_segs, dur):
                        log.debug("[SKIP thank-you noise] (%.2fs) %r", dur, text)
                        continue
                    if should_drop_utterance(text, dur):
                        log.debug("[SKIP] (%.2fs) %r", dur, text)
                        continue

                ts = time.time()
                uid = seg.utterance_id
                enrich = await asyncio.to_thread(
                    enrich_utterance, text, final, SAMPLE_RATE
                )
                lang_meta = _language_payload(whisper_info)

                volume_db = round(20.0 * np.log10(max(buf_rms, 1e-10)), 2)
                seg_meta = _segment_metrics(whisper_segs)

                log.info(
                    "[AI] [%s] %s | laugh=%s emo=%s dB=%.1f nsp=%.3f",
                    lang_meta.get("language"),
                    text,
                    enrich["laughter_detected"],
                    enrich["emotion_text"],
                    volume_db,
                    seg_meta["no_speech_prob"],
                )
                await relay.ingest(text, ts, uid)
    finally:
        obs_task.cancel()
        with suppress(asyncio.CancelledError):
            await obs_task
        await relay.source_offline()
        await relay.close()


def main() -> None:
    try:
        if os.environ.get("STT_LIST_DEVICES", "").strip().lower() in (
            "1",
            "true",
            "yes",
        ):
            print_input_devices()
            return
        if not acquire_streamer_lock():
            log.error(
                "Another STT streamer is already running. "
                "Stop the other process or set STT_ALLOW_MULTIPLE_STREAMERS=1 (debug only)."
            )
            raise SystemExit(1)

        async def _run() -> None:
            stop = asyncio.Event()
            loop = asyncio.get_running_loop()
            for sig in (signal.SIGINT, signal.SIGTERM):
                try:
                    loop.add_signal_handler(sig, stop.set)
                except (NotImplementedError, ValueError):
                    pass
            await transcribe_and_stream(stop)

        asyncio.run(_run())
    except KeyboardInterrupt:
        log.info("Stopped.")


if __name__ == "__main__":
    main()
