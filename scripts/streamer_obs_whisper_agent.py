"""
SweetFlips streamer PC: mic → faster-whisper (CUDA) → WebSocket STT relay
(role=streamer on /ws/stt, same protocol as relay_server.py).

OBS WebSocket gates transcription when the stream is live (optional).

Usage:
  python streamer_obs_whisper_agent.py --config path/to/streamer_agent.json
  python streamer_obs_whisper_agent.py --config path/to/streamer_agent.json --list-devices
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import queue
import signal
import sys
import threading
import time
from collections import deque
from contextlib import suppress
from dataclasses import dataclass
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any

import re
from urllib.parse import parse_qsl, urlencode, urlparse, urlsplit, urlunsplit, urlunparse

import httpx
import numpy as np
import websockets
import sounddevice as sd
from dotenv import load_dotenv
from faster_whisper import WhisperModel

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from emotion_laughter import enrich_utterance
from stt_audio_devices import print_input_devices
from stt_single_instance import acquire_streamer_lock
from transcript_normalization import normalize_vocab

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]

for _k, _v in (("OMP_NUM_THREADS", "4"), ("MKL_NUM_THREADS", "4"), ("OPENBLAS_NUM_THREADS", "4")):
    os.environ.setdefault(_k, _v)

POST_MAX_ATTEMPTS = 5
BACKOFF_CAP_S = 30.0
# WebSocket transcript JSON: bump when adding/removing top-level fields listeners rely on.
WS_TRANSCRIPT_PROTO = 2
# relay_server.py drops frames over STT_MAX_WS_MESSAGE_BYTES (default 65536); stay under with margin.
_FIT_WS_MAX_BYTES = int(os.environ.get("STT_WS_SEND_MAX_BYTES", "62000"))
RMS_THRESHOLD = 0.018
END_SILENCE_S = 0.35
MIN_SPEECH_S = 0.35
AUDIO_QUEUE_MAX_CHUNKS = 200

_transcription_live = threading.Event()
_transcription_live.set()
_obs_req_client: Any = None
_obs_last_conn: tuple[str, int, str] | None = None
_dotenv_loaded = False
log = logging.getLogger("nick")


def load_dotenv_for_project() -> None:
    """Load `.env` so OBS/relay secrets apply.

    `override=True` makes values from the file win over process environment. That fixes
    Task Scheduler / shells where OBS_WS_* is empty or set to a placeholder string.
    """
    global _dotenv_loaded
    if _dotenv_loaded:
        return
    env_project = _PROJECT_ROOT / ".env"
    if env_project.is_file():
        load_dotenv(env_project, override=True)
    env_cwd = Path.cwd() / ".env"
    if env_cwd.is_file() and env_cwd.resolve() != env_project.resolve():
        load_dotenv(env_cwd, override=True)
    _dotenv_loaded = True


def obs_ws_enabled(cfg: dict[str, Any]) -> bool:
    """False if OBS_WS_ENABLED is off; else JSON obs.enabled (default True)."""
    if os.environ.get("OBS_WS_ENABLED", "1").strip().lower() in ("0", "false", "no", "off"):
        return False
    o = cfg.get("obs") or {}
    return bool(o.get("enabled", True))


def relay_base_url(cfg: dict[str, Any]) -> str:
    """`STT_RELAY_URL` or `RELAY_BASE_URL` in .env overrides JSON `relay.base_url`."""
    load_dotenv_for_project()
    env = (os.environ.get("STT_RELAY_URL") or os.environ.get("RELAY_BASE_URL") or "").strip()
    if env:
        return env.rstrip("/")
    r = cfg.get("relay") or {}
    return str(r.get("base_url") or "http://127.0.0.1:8766").strip().rstrip("/")


def _is_placeholder_password(value: str) -> bool:
    s = (value or "").strip()
    return not s or s.startswith("REPLACE_") or "REPLACE_WITH_" in s


def obs_ws_connection(cfg: dict[str, Any]) -> tuple[str, int, str]:
    """Host/port/password: OBS_WS_* from .env override JSON (same idea as streamer_agent.py)."""
    load_dotenv_for_project()
    o = cfg.get("obs") or {}
    host = (os.environ.get("OBS_WS_HOST") or "").strip() or str(o.get("host") or "127.0.0.1")
    port_s = (os.environ.get("OBS_WS_PORT") or "").strip()
    port = int(port_s) if port_s else int(o.get("port") or 4455)
    pw = (os.environ.get("OBS_WS_PASSWORD") or "").strip()
    if _is_placeholder_password(pw):
        pw = str(o.get("password") or "").strip()
    if _is_placeholder_password(pw):
        pw = ""
    return host, port, pw


def load_config(path: Path) -> dict[str, Any]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def setup_logging(cfg: dict[str, Any]) -> None:
    level_name = (cfg.get("log_level") or "INFO").strip().upper()
    level = getattr(logging, level_name, logging.INFO)
    log_path = cfg.get("log_path") or ""
    fmt = logging.Formatter(
        "%(asctime)s %(levelname)s [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(level)
    sh = logging.StreamHandler(sys.stderr)
    sh.setFormatter(fmt)
    root.addHandler(sh)
    if log_path:
        p = Path(log_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        fh = RotatingFileHandler(
            p, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"
        )
        fh.setFormatter(fmt)
        root.addHandler(fh)
    log.setLevel(level)
    # Silence noisy third-party loggers — only show our transcript lines
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("faster_whisper").setLevel(logging.WARNING)
    logging.getLogger("obsws_python").setLevel(logging.CRITICAL)
    logging.getLogger("websockets").setLevel(logging.WARNING)


def resolve_input_device(cfg: dict[str, Any]) -> int:
    devices = sd.query_devices()
    raw = cfg.get("audio", {}).get("device")
    if raw is None:
        try:
            d = sd.default.device
            idx = int(d[0])
        except Exception:
            raise SystemExit("No default input device") from None
        if idx < 0 or idx >= len(devices):
            raise SystemExit("Invalid default input device index")
        if int(devices[idx]["max_input_channels"]) <= 0:
            raise SystemExit(f"Default device {idx} is not an input")
        log.info("Using default input device [%s] %s", idx, devices[idx]["name"])
        return idx
    if isinstance(raw, int):
        idx = raw
        if idx < 0 or idx >= len(devices):
            raise SystemExit(f"Invalid device index {idx}")
        if int(devices[idx]["max_input_channels"]) <= 0:
            raise SystemExit(f"Device {idx} is not an input")
        log.info("Using input [%s] %s", idx, devices[idx]["name"])
        return idx
    if isinstance(raw, str):
        name = raw.strip()
        for i, dev in enumerate(devices):
            if int(dev["max_input_channels"]) > 0 and dev["name"].strip() == name:
                log.info("Using input [%s] %s", i, dev["name"])
                return i
        log.error("No device named %r", name)
        print_input_devices()
        raise SystemExit(1)
    raise SystemExit(f"audio.device must be null, int, or string, got {type(raw)}")


def stream_id_from_cfg(cfg: dict[str, Any]) -> str:
    """`STT_STREAM_ID` in .env overrides JSON `relay.source_name` (WebSocket stream_id)."""
    load_dotenv_for_project()
    env = (os.environ.get("STT_STREAM_ID") or "").strip()
    if env:
        return env
    r = cfg.get("relay") or {}
    return str(r.get("source_name") or "streamer-pc").strip() or "streamer-pc"


def relay_websocket_url(cfg: dict[str, Any]) -> str:
    """WS URL for `relay_server.py` /ws/stt with token + role=streamer.

    - `STT_WS_URL` (ws:// or wss://) overrides JSON `relay.base_url` mapping.
    - Else: same host/port as `relay.base_url` / `STT_RELAY_URL`, path `/ws/stt`.
    """
    load_dotenv_for_project()
    token = (os.environ.get("STT_WS_TOKEN") or "").strip()
    override = (os.environ.get("STT_WS_URL") or "").strip()
    if override:
        u = override
    else:
        http_base = relay_base_url(cfg)
        p = urlparse(http_base)
        scheme = "wss" if p.scheme == "https" else "ws"
        netloc = p.netloc
        if not netloc:
            netloc = "127.0.0.1:8000"
        path = "/ws/stt"
        u = urlunparse((scheme, netloc, path, "", "", ""))
    parts = urlsplit(u)
    q = dict(parse_qsl(parts.query, keep_blank_values=True))
    if token and "token" not in q:
        q["token"] = token
    if "role" not in q:
        q["role"] = "streamer"
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(q), parts.fragment))


def _ws_url_for_log(url: str) -> str:
    if "token=" not in url:
        return url
    base, _, _ = url.partition("?")
    return f"{base}?token=***"


def _fit_ws_payload(body: dict[str, Any], max_bytes: int = _FIT_WS_MAX_BYTES) -> dict[str, Any]:
    """Drop segments/metrics or fall back to minimal fields so relay_server does not drop the frame."""
    b = dict(body)
    for _ in range(3):
        raw = json.dumps(b, ensure_ascii=False).encode("utf-8")
        if len(raw) <= max_bytes:
            return b
        if b.pop("segments", None) is not None:
            log.warning(
                "WS payload %d bytes — omitting segments (limit %d)",
                len(raw),
                max_bytes,
            )
            continue
        if b.pop("metrics", None) is not None:
            log.warning(
                "WS payload %d bytes — omitting metrics (limit %d)",
                len(raw),
                max_bytes,
            )
            continue
        break
    raw = json.dumps(b, ensure_ascii=False).encode("utf-8")
    if len(raw) <= max_bytes:
        return b
    sid = str(b.get("stream_id") or b.get("source") or "streamer")
    log.error(
        "WS payload still %d bytes after shrink — sending minimal transcript only",
        len(raw),
    )
    return {
        "type": "transcript",
        "proto": int(b.get("proto", WS_TRANSCRIPT_PROTO)),
        "text": str(b.get("text", ""))[:8000],
        "is_final": True,
        "timestamp": b.get("timestamp"),
        "stream_id": sid,
        "source": sid,
        "truncated": True,
    }


class RelayClient:
    """Transcripts over WebSocket (relay_server.py). GET /health uses HTTP same host as relay.base_url."""

    def __init__(self, cfg: dict[str, Any]) -> None:
        r = cfg["relay"]
        self._cfg = cfg
        self._base = relay_base_url(cfg)
        self._source_name = stream_id_from_cfg(cfg)
        self._timeout = float(r.get("timeout_secs") or 5.0)
        self._backoff_base = float(r.get("retry_backoff_secs") or 3.0)
        self._client = httpx.AsyncClient(timeout=self._timeout)
        self._ws: Any = None
        self._ws_lock = asyncio.Lock()
        self._reader_task: asyncio.Task[None] | None = None
        self._last_utterance_id: int | None = None
        self._ws_url = relay_websocket_url(cfg)

    @property
    def base_url(self) -> str:
        return self._base

    async def check_health(self) -> bool:
        """GET /health on the relay host (FastAPI next to /ws/stt)."""
        url = f"{self._base}/health"
        try:
            r = await self._client.get(url)
            if r.status_code >= 300:
                log.warning("relay host %s /health -> HTTP %s", self._base, r.status_code)
                return False
            try:
                data = r.json()
                if isinstance(data, dict):
                    log.info(
                        "Relay %s /health service=%s streamers=%s",
                        self._base,
                        data.get("service", "?"),
                        data.get("streamers_connected", "?"),
                    )
                else:
                    log.info("Connected to relay host %s", self._base)
            except Exception:
                log.info("Connected to relay host %s (health body not JSON)", self._base)
            return True
        except httpx.HTTPError as e:
            log.warning("Cannot reach relay host at %s: %s", self._base, e)
            return False

    async def _reader_loop(self) -> None:
        """Drain server messages (welcome, ping) so the connection stays healthy."""
        try:
            while True:
                async with self._ws_lock:
                    ws = self._ws
                if ws is None:
                    break
                await ws.recv()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            log.warning("WebSocket reader ended: %s", e)
        finally:
            async with self._ws_lock:
                self._ws = None
                if self._reader_task is asyncio.current_task():
                    self._reader_task = None

    async def _connect_ws(self) -> bool:
        backoff = self._backoff_base
        for attempt in range(POST_MAX_ATTEMPTS):
            ws: Any = None
            try:
                ws = await websockets.connect(
                    self._ws_url,
                    ping_interval=20,
                    ping_timeout=60,
                    open_timeout=min(30.0, self._timeout),
                )
                hello = json.dumps(
                    {
                        "type": "client_hello",
                        "stream_id": self._source_name,
                        "role": "streamer",
                    },
                    ensure_ascii=False,
                )
                await ws.send(hello)
                async with self._ws_lock:
                    if self._ws is not None:
                        await ws.close()
                        return True
                    self._ws = ws
                    self._reader_task = asyncio.create_task(self._reader_loop())
                log.info("STT WebSocket connected %s", _ws_url_for_log(self._ws_url))
                return True
            except Exception as e:
                if ws is not None:
                    with suppress(Exception):
                        await ws.close()
                log.warning(
                    "WebSocket connect failed (attempt %s): %s — %s",
                    attempt + 1,
                    _ws_url_for_log(self._ws_url),
                    e,
                )
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, BACKOFF_CAP_S)
        log.error("WebSocket: gave up after %s attempts", POST_MAX_ATTEMPTS)
        return False

    async def source_online(self) -> bool:
        """Connect as streamer; relay notifies listeners (streamer_online)."""
        async with self._ws_lock:
            ws = self._ws
            if ws is not None and not getattr(ws, "closed", False):
                return True
            t = self._reader_task
            self._reader_task = None
            self._ws = None
        if t is not None:
            t.cancel()
            with suppress(asyncio.CancelledError):
                await t
        if ws is not None:
            with suppress(Exception):
                await ws.close()
        return await self._connect_ws()

    async def source_offline(self) -> bool:
        """Disconnect; relay broadcasts streamer_offline when last streamer leaves."""
        async with self._ws_lock:
            t = self._reader_task
            self._reader_task = None
            w = self._ws
            self._ws = None
        if t is not None:
            t.cancel()
            with suppress(asyncio.CancelledError):
                await t
        if w is not None:
            with suppress(Exception):
                await w.close()
        log.debug("STT WebSocket disconnected")
        return True

    async def ingest(self, body: dict[str, Any], utterance_id: int | None) -> bool:
        """Send a full transcript JSON object (see ``build_ws_transcript_body``)."""
        if utterance_id is not None and utterance_id == self._last_utterance_id:
            return True
        body = _fit_ws_payload(dict(body))
        payload = json.dumps(body, ensure_ascii=False)

        async def _send_once() -> bool:
            async with self._ws_lock:
                ws = self._ws
            if ws is None:
                return False
            try:
                await ws.send(payload)
            except Exception as e:
                log.warning("WebSocket send failed: %s", e)
                async with self._ws_lock:
                    t = self._reader_task
                    self._reader_task = None
                    self._ws = None
                if t is not None:
                    t.cancel()
                    with suppress(asyncio.CancelledError):
                        await t
                return False
            return True

        if not await _send_once():
            if not await self.source_online():
                log.warning("ingest skipped: WebSocket not connected after reconnect")
                return False
            if not await _send_once():
                log.warning("ingest failed after reconnect")
                return False
        if utterance_id is not None:
            self._last_utterance_id = utterance_id
        return True

    async def close(self) -> None:
        await self.source_offline()
        await self._client.aclose()


@dataclass
class AudioChunk:
    samples: np.ndarray
    ts: float


audio_queue: queue.Queue[AudioChunk] = queue.Queue(maxsize=AUDIO_QUEUE_MAX_CHUNKS)
_dropped_chunks = 0


def _enqueue(chunk: AudioChunk) -> None:
    global _dropped_chunks
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
    _dropped_chunks += 1
    if _dropped_chunks == 1 or _dropped_chunks % 25 == 0:
        log.warning("audio queue overflow; dropped %s chunks", _dropped_chunks)


def audio_callback(indata, frames, time_info, status):
    if status:
        log.debug("audio status: %s", status)
    if not _transcription_live.is_set():
        return
    mono = np.squeeze(indata.copy())
    _enqueue(AudioChunk(samples=mono.astype(np.float32), ts=time.time()))


def rms(x: np.ndarray) -> float:
    if x.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(np.square(x), dtype=np.float64)))


class SpeechSegmenter:
    def __init__(
        self,
        sample_rate: int,
        max_segment_s: float,
        *,
        rms_threshold: float = RMS_THRESHOLD,
        end_silence_s: float = END_SILENCE_S,
        min_speech_s: float = MIN_SPEECH_S,
    ) -> None:
        self._sr = sample_rate
        self._max_seg = max_segment_s
        self._rms_threshold = rms_threshold
        self._end_silence_s = end_silence_s
        self._min_speech_s = min_speech_s
        self._in_speech = False
        self._speech_start_ts: float | None = None
        self._last_loud_ts: float | None = None
        self._buf: list[np.ndarray] = []
        self.utterance_id = 0

    def push(self, chunk: AudioChunk) -> np.ndarray | None:
        now = chunk.ts
        level = rms(chunk.samples)
        loud = level >= self._rms_threshold
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
        too_long = duration >= self._max_seg
        end_silence = (
            silence >= self._end_silence_s and duration >= self._min_speech_s
        )
        if too_long or end_silence:
            seg = np.concatenate(self._buf, axis=0).astype(np.float32)
            self._in_speech = False
            self._speech_start_ts = None
            self._last_loud_ts = None
            self._buf = []
            if seg.size / self._sr < self._min_speech_s and not too_long:
                return None
            return seg
        return None


def speech_segmenter_from_cfg(cfg: dict[str, Any]) -> SpeechSegmenter:
    a = cfg.get("audio") or {}
    sr = int(a.get("samplerate") or 16000)
    max_buf = float(a.get("max_buffer_secs") or 8.0)
    return SpeechSegmenter(
        sr,
        max_buf,
        rms_threshold=float(a.get("segment_rms_threshold", RMS_THRESHOLD)),
        end_silence_s=float(a.get("end_silence_secs", END_SILENCE_S)),
        min_speech_s=float(a.get("min_speech_secs", MIN_SPEECH_S)),
    )


def _queue_get(timeout: float) -> AudioChunk:
    return audio_queue.get(timeout=timeout)


async def get_chunk(stop: asyncio.Event) -> AudioChunk | None:
    while not stop.is_set():
        try:
            return await asyncio.to_thread(_queue_get, 0.25)
        except queue.Empty:
            continue
    return None


_obs_fail_count = 0
_OBS_FAIL_LOG_EVERY = 30


def obs_get_stream_active(cfg: dict[str, Any]) -> bool | None:
    global _obs_req_client, _obs_last_conn, _obs_fail_count
    if not obs_ws_enabled(cfg):
        return None
    try:
        from obsws_python import ReqClient
    except ImportError:
        log.info("obsws-python not installed; transcribing without OBS gating")
        return None
    # Suppress obsws_python's own ERROR logs after the first failure
    logging.getLogger("obsws_python").setLevel(logging.CRITICAL)
    host, port, password = obs_ws_connection(cfg)
    if _obs_req_client is not None and _obs_last_conn != (host, port, password):
        _obs_req_client = None
        _obs_last_conn = None
        _obs_fail_count = 0
    if _obs_req_client is None:
        try:
            _obs_req_client = ReqClient(
                host=host,
                port=port,
                password=password,
                timeout=5,
            )
            _obs_last_conn = (host, port, password)
            if _obs_fail_count > 0:
                log.info("OBS reconnected after %s failures", _obs_fail_count)
            _obs_fail_count = 0
        except Exception as e:
            _obs_fail_count += 1
            if _obs_fail_count == 1:
                log.warning("OBS connect failed (%s:%s): %s", host, port, e)
            elif _obs_fail_count % _OBS_FAIL_LOG_EVERY == 0:
                log.warning("OBS still unreachable (%s failures)", _obs_fail_count)
            return None
    try:
        r = _obs_req_client.get_stream_status()
        oa = getattr(r, "output_active", None) or getattr(r, "outputActive", None)
        if oa is None and isinstance(r, dict):
            oa = r.get("outputActive") or r.get("output_active")
        if oa is None:
            return None
        return bool(oa)
    except Exception as e:
        _obs_fail_count += 1
        if _obs_fail_count == 1 or _obs_fail_count % _OBS_FAIL_LOG_EVERY == 0:
            log.warning("OBS get_stream_status failed (%s failures): %s", _obs_fail_count, e)
        _obs_req_client = None
        _obs_last_conn = None
        return None


async def obs_poll_loop(
    stop: asyncio.Event,
    cfg: dict[str, Any],
    relay: RelayClient,
    segmenter_box: list[SpeechSegmenter],
) -> None:
    interval = float((cfg.get("obs") or {}).get("poll_interval_secs") or 2.0)
    prev: bool | None = None
    online_announced = False
    while not stop.is_set():
        active = await asyncio.to_thread(obs_get_stream_active, cfg)
        o = cfg.get("obs") or {}
        # When false: keep OBS connected but transcribe even if not broadcasting (test without going live).
        if o.get("enabled", True) and not o.get("require_stream_active", True):
            if active is not None:
                active = True
        if active is None:
            _transcription_live.set()
            if prev is False:
                segmenter_box[0] = speech_segmenter_from_cfg(cfg)
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
                    segmenter_box[0] = speech_segmenter_from_cfg(cfg)
                await relay.source_online()
                online_announced = True
            prev = True
        else:
            _transcription_live.clear()
            if prev is not False:
                segmenter_box[0] = speech_segmenter_from_cfg(cfg)
                await relay.source_offline()
                online_announced = False
            prev = False
        if online_announced and _transcription_live.is_set():
            await relay.source_online()
        await asyncio.sleep(interval)


def _normalize_dedup(t: str) -> str:
    return " ".join(t.lower().strip().split())


def _normalize_phrase(t: str) -> str:
    """Lowercase, strip whitespace and trailing punctuation — used for phrase matching."""
    return " ".join(t.lower().strip().rstrip(".!?").split())


# Whisper sometimes hallucinates offensive one-word garbage on noise — drop, don't relay.
# Keep tight: explicit tokens + short nigg* hallucinations only (avoid matching unrelated words).
_SLUR_HALLUCINATION_RE = re.compile(
    r"(?i)\b(?:nigg(?:er|um|em|a|ah|e|ums?|ems?)|nigem|niggum|nigg[aeiou]{1,3})\b"
)


def should_drop_slur_hallucination(text: str) -> bool:
    return bool(_SLUR_HALLUCINATION_RE.search(text))


# --- Hallucination / no-speech filters (ported from streamer_agent.py) ------
BANNED_UTTERANCES = frozenset({
    "thanks for watching",
    "thank you for watching",
    "bye",
    "mmm",
    "mm-hmm",
    "uh",
    "um",
})

THANK_YOU_GRATITUDE_PHRASES = frozenset({
    "thank you",
    "thanks",
    "thank you very much",
    "thank you so much",
    "thanks a lot",
    "thanks so much",
})

HALLUCINATION_MAX_SECONDS = 1.1
HALLUCINATION_PHRASES_SHORT = frozenset({
    "thanks for watching",
    "thank you for watching",
    "bye",
    "mmm",
    "mm-hmm",
    "uh",
    "um",
})

DROP_IF_AVG_NO_SPEECH_ABOVE = 0.38
DROP_IF_MAX_NO_SPEECH_ABOVE = 0.82
THANK_YOU_KEEP_MAX_AVG_NSP = 0.28


def _filter_thresholds(cfg: dict[str, Any] | None) -> tuple[float, float, float, float]:
    """Returns (drop_avg_nsp, drop_max_nsp, combo_avg_nsp, combo_avg_log)."""
    if not cfg:
        return (
            DROP_IF_AVG_NO_SPEECH_ABOVE,
            DROP_IF_MAX_NO_SPEECH_ABOVE,
            0.26,
            -0.62,
        )
    tf = cfg.get("transcript_filter") or {}
    return (
        float(tf.get("drop_avg_no_speech_above", DROP_IF_AVG_NO_SPEECH_ABOVE)),
        float(tf.get("drop_max_no_speech_above", DROP_IF_MAX_NO_SPEECH_ABOVE)),
        float(tf.get("combo_avg_no_speech_above", 0.26)),
        float(tf.get("combo_avg_logprob_below", -0.62)),
    )


def should_drop_likely_no_speech(
    text: str, whisper_segments: list, cfg: dict[str, Any] | None = None
) -> bool:
    if not text.strip() or not whisper_segments:
        return True
    drop_avg, drop_max, combo_nsp, combo_log = _filter_thresholds(cfg)
    avg_nsp = sum(s.no_speech_prob for s in whisper_segments) / len(whisper_segments)
    avg_log = sum(s.avg_logprob for s in whisper_segments) / len(whisper_segments)
    max_nsp = max(s.no_speech_prob for s in whisper_segments)
    max_cr = max(s.compression_ratio for s in whisper_segments)
    tf = (cfg or {}).get("transcript_filter") or {}
    max_cr_drop = float(tf.get("drop_compression_ratio_above", 2.75))
    if max_cr >= max_cr_drop:
        return True
    if max_nsp >= drop_max:
        return True
    if avg_nsp >= drop_avg:
        return True
    if avg_nsp >= combo_nsp and avg_log < combo_log:
        return True
    return False


def should_drop_thank_you_hallucination(text: str, whisper_segments: list) -> bool:
    n = _normalize_phrase(text)
    if n not in THANK_YOU_GRATITUDE_PHRASES:
        return False
    if not whisper_segments:
        return True
    avg_nsp = sum(s.no_speech_prob for s in whisper_segments) / len(whisper_segments)
    return avg_nsp >= THANK_YOU_KEEP_MAX_AVG_NSP


def should_drop_utterance(text: str, audio_seconds: float) -> bool:
    n = _normalize_phrase(text)
    if not n:
        return True
    if n in BANNED_UTTERANCES:
        return True
    if audio_seconds <= HALLUCINATION_MAX_SECONDS and n in HALLUCINATION_PHRASES_SHORT:
        return True
    return False


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


# --- Dedup window -----------------------------------------------------------
class DedupWindow:
    def __init__(self, window_s: float):
        self._window = window_s
        self._q: deque[tuple[str, float]] = deque()

    def is_dup(self, text: str, now: float) -> bool:
        n = _normalize_dedup(text)
        if not n:
            return True
        while self._q and now - self._q[0][1] > self._window:
            self._q.popleft()
        for prev, _ in self._q:
            if prev == n:
                return True
        self._q.append((n, now))
        return False


# --- Transcription -----------------------------------------------------------
def transcribe_sync(
    model: WhisperModel, audio: np.ndarray, cfg: dict[str, Any]
) -> tuple[str, list, Any]:
    w = cfg.get("whisper") or {}
    lang = (w.get("language") or "en").strip()
    if lang.lower() in ("auto", "detect"):
        lang_code = None
    else:
        lang_code = lang
    vad_filter = bool(w.get("vad_filter", True))
    vad_parameters: dict[str, Any] = {}
    if "min_silence_duration_ms" in w:
        vad_parameters["min_silence_duration_ms"] = int(w["min_silence_duration_ms"])
    msd = w.get("min_speech_duration_ms")
    if msd is not None and int(msd) > 0:
        vad_parameters["min_speech_duration_ms"] = int(msd)
    if "speech_pad_ms" in w:
        vad_parameters["speech_pad_ms"] = int(w["speech_pad_ms"])
    threshold = w.get("vad_threshold")
    if threshold is not None:
        vad_parameters["threshold"] = float(threshold)
    beam_size = int(w.get("beam_size") or 1)
    best_of = int(w.get("best_of") or beam_size)
    patience = float(w.get("patience") or 1.0)
    initial_prompt = (w.get("initial_prompt") or "").strip() or None
    hotwords = (w.get("hotwords") or "").strip() or None
    cr_th = w.get("compression_ratio_threshold")
    if cr_th is None:
        cr_th = 2.4
    else:
        cr_th = float(cr_th)
    tc_extra: dict[str, Any] = {}
    if w.get("temperature") is not None:
        tc_extra["temperature"] = w["temperature"]
    word_timestamps = bool(w.get("word_timestamps", False))
    try:
        segments, info = model.transcribe(
            audio,
            language=lang_code,
            task="transcribe",
            vad_filter=vad_filter,
            vad_parameters=vad_parameters if vad_parameters else None,
            beam_size=beam_size,
            best_of=best_of,
            patience=patience,
            condition_on_previous_text=bool(w.get("condition_on_previous_text", False)),
            repetition_penalty=float(w.get("repetition_penalty") or 1.15),
            no_repeat_ngram_size=int(w.get("no_repeat_ngram_size") or 3),
            no_speech_threshold=float(w.get("no_speech_threshold") or 0.68),
            log_prob_threshold=float(w.get("log_prob_threshold") or -0.32),
            compression_ratio_threshold=cr_th,
            initial_prompt=initial_prompt,
            hotwords=hotwords,
            word_timestamps=word_timestamps,
            **tc_extra,
        )
    except Exception as e:
        log.exception("transcribe failed: %s", e)
        return "", [], None
    segs = list(segments)
    parts: list[str] = []
    prev_norm: str | None = None
    for s in segs:
        t = getattr(s, "text", "") or ""
        if not t.strip():
            continue
        n = _normalize_phrase(t)
        if prev_norm is not None and n == prev_norm:
            continue
        parts.append(t)
        prev_norm = n
    text = "".join(parts).strip()
    text = _strip_duplicate_full_utterance(text)
    return text, segs, info


def _metrics_from_whisper_segments(segs: list) -> dict[str, float | int]:
    if not segs:
        return {"segment_count": 0}
    n = len(segs)
    return {
        "segment_count": n,
        "avg_logprob": float(sum(s.avg_logprob for s in segs) / n),
        "avg_no_speech_prob": float(sum(s.no_speech_prob for s in segs) / n),
        "max_no_speech_prob": float(max(s.no_speech_prob for s in segs)),
        "max_compression_ratio": float(max(s.compression_ratio for s in segs)),
    }


def _segments_for_ws(segs: list, *, include_words: bool) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for s in segs:
        raw = (getattr(s, "text", "") or "").strip()
        if not raw:
            continue
        t = normalize_vocab(raw)
        if not t.strip():
            continue
        item: dict[str, Any] = {
            "start": round(float(s.start), 3),
            "end": round(float(s.end), 3),
            "text": t.strip(),
        }
        words = getattr(s, "words", None)
        if include_words and words:
            item["words"] = [
                {
                    "word": w.word,
                    "start": round(float(w.start), 3),
                    "end": round(float(w.end), 3),
                    "probability": round(float(w.probability), 4),
                }
                for w in words
            ]
        out.append(item)
    return out


def _info_for_ws(info: Any) -> dict[str, Any]:
    if info is None:
        return {}
    lang = getattr(info, "language", None)
    lp = getattr(info, "language_probability", None)
    dur = getattr(info, "duration", None)
    dvad = getattr(info, "duration_after_vad", None)
    d: dict[str, Any] = {}
    if isinstance(lang, str) and lang:
        d["language"] = lang
    if lp is not None:
        try:
            d["language_probability"] = round(float(lp), 4)
        except (TypeError, ValueError):
            pass
    if dur is not None:
        try:
            d["duration_model_s"] = round(float(dur), 3)
        except (TypeError, ValueError):
            pass
    if dvad is not None:
        try:
            d["duration_after_vad_s"] = round(float(dvad), 3)
        except (TypeError, ValueError):
            pass
    return d


def build_ws_transcript_body(
    cfg: dict[str, Any],
    *,
    text: str,
    ts: float,
    utterance_id: int | None,
    whisper_segs: list,
    info: Any,
    audio_duration_s: float,
    sample_rate: int,
    buffer_rms: float,
    audio_mono: np.ndarray | None = None,
) -> dict[str, Any]:
    """Rich JSON for listeners (overlay, logging, quality UI)."""
    r = cfg.get("relay") or {}
    include_metrics = bool(r.get("include_ws_metrics", True))
    include_segments = bool(r.get("include_ws_segments", True))
    wcfg = cfg.get("whisper") or {}
    include_words = bool(wcfg.get("word_timestamps", False))

    sid = stream_id_from_cfg(cfg)
    body: dict[str, Any] = {
        "type": "transcript",
        "proto": WS_TRANSCRIPT_PROTO,
        "text": text,
        "is_final": True,
        "timestamp": ts,
        "source": sid,
        "stream_id": sid,
    }
    if utterance_id is not None:
        body["utterance_id"] = utterance_id
    body["audio_duration_s"] = round(float(audio_duration_s), 3)
    body["sample_rate"] = int(sample_rate)
    body["buffer_rms"] = round(float(buffer_rms), 5)

    info_extra = _info_for_ws(info)
    if info_extra:
        body.update(info_extra)

    if include_metrics and whisper_segs:
        body["metrics"] = _metrics_from_whisper_segments(whisper_segs)

    if include_segments and whisper_segs:
        body["segments"] = _segments_for_ws(whisper_segs, include_words=include_words)

    if bool(r.get("emotion_laughter", False)) and audio_mono is not None and audio_mono.size > 0:
        ex = enrich_utterance(text, audio_mono, int(sample_rate))
        body["laughter"] = {
            "detected": ex["laughter_detected"],
            "score": ex["laughter_score"],
        }
        emo: dict[str, Any] = {"text": ex["emotion_text"]}
        voice = ex.get("emotion_voice") or ""
        if voice:
            emo["voice"] = voice
        conf = float(ex.get("emotion_voice_confidence") or 0.0)
        if conf > 0:
            emo["voice_confidence"] = conf
        body["emotion"] = emo

    return body


async def run_agent(cfg: dict[str, Any], stop: asyncio.Event) -> None:
    sr = int(cfg["audio"]["samplerate"])
    channels = int(cfg["audio"].get("channels") or 1)
    stride = float(cfg["audio"].get("stride_secs") or 0.25)
    blocksize = max(256, int(sr * stride))
    a_cfg = cfg.get("audio") or {}
    min_transcribe_rms = float(a_cfg.get("min_transcribe_rms", 0.014))

    dev_idx = resolve_input_device(cfg)
    wcfg = cfg.get("whisper") or {}
    compute_type = str(wcfg.get("compute_type") or "int8")
    log.info(
        "Loading Whisper %s (%s, %s)...",
        wcfg.get("model_size", "large-v3"),
        wcfg.get("device", "cuda"),
        compute_type,
    )
    try:
        wm_kw: dict[str, Any] = {
            "device": str(wcfg.get("device") or "cuda"),
            "compute_type": compute_type,
            "cpu_threads": int(wcfg.get("cpu_threads") or 4),
            "num_workers": int(wcfg.get("num_workers") or 1),
        }
        if wcfg.get("device_index") is not None:
            wm_kw["device_index"] = int(wcfg["device_index"])
        model = WhisperModel(str(wcfg.get("model_size") or "large-v3"), **wm_kw)
    except Exception:
        log.exception("Whisper model load failed")
        raise SystemExit(1) from None

    _ip = (wcfg.get("initial_prompt") or "").strip()
    _hw = (wcfg.get("hotwords") or "").strip()
    if _ip:
        log.info("Whisper initial_prompt on (%s chars)", len(_ip))
    if _hw:
        log.info("Whisper hotwords on (%s chars)", len(_hw))

    relay = RelayClient(cfg)
    log.info(
        "Model ready. Relay HTTP %s stream_id=%s (transcripts via WebSocket)",
        relay.base_url,
        stream_id_from_cfg(cfg),
    )
    if bool((cfg.get("relay") or {}).get("health_check_on_start", True)):
        await relay.check_health()

    segmenter_box = [speech_segmenter_from_cfg(cfg)]
    dedup = DedupWindow(float(cfg.get("dedup_window_secs") or 8.0))
    min_chars = int(cfg.get("min_text_chars") or 2)

    obs_task = asyncio.create_task(obs_poll_loop(stop, cfg, relay, segmenter_box))

    try:
        with sd.InputStream(
            device=dev_idx,
            channels=channels,
            samplerate=sr,
            blocksize=blocksize,
            dtype="float32",
            callback=audio_callback,
        ):
            log.info("Listening (final transcripts only). Ctrl+C to stop.")
            while not stop.is_set():
                chunk = await get_chunk(stop)
                if chunk is None:
                    break
                seg = segmenter_box[0]
                final = seg.push(chunk)
                if final is None or final.size == 0:
                    continue
                buf_rms = rms(final)
                if buf_rms < min_transcribe_rms:
                    continue
                dur = float(final.size) / sr
                text, whisper_segs, whisper_info = await asyncio.to_thread(
                    transcribe_sync, model, final, cfg
                )
                if not text or len(text.strip()) < min_chars:
                    continue
                text = normalize_vocab(text)
                if should_drop_slur_hallucination(text):
                    log.debug("[SKIP slur hallucination] (%.2fs) %r", dur, text[:80])
                    continue
                if should_drop_likely_no_speech(text, whisper_segs, cfg):
                    log.debug("[SKIP no-speech] (%.2fs) rms=%.4f %r", dur, buf_rms, text[:80])
                    continue
                if should_drop_thank_you_hallucination(text, whisper_segs):
                    log.debug("[SKIP thank-you noise] (%.2fs) %r", dur, text[:80])
                    continue
                if should_drop_utterance(text, dur):
                    log.debug("[SKIP banned/short] (%.2fs) %r", dur, text[:80])
                    continue
                ts = time.time()
                if dedup.is_dup(text, ts):
                    log.debug("[SKIP dedup] %r", text[:80])
                    continue
                log.info("[transcript] %s", text)
                ws_body = build_ws_transcript_body(
                    cfg,
                    text=text,
                    ts=ts,
                    utterance_id=seg.utterance_id,
                    whisper_segs=whisper_segs,
                    info=whisper_info,
                    audio_duration_s=dur,
                    sample_rate=sr,
                    buffer_rms=buf_rms,
                    audio_mono=final,
                )
                await relay.ingest(ws_body, seg.utterance_id)
    finally:
        obs_task.cancel()
        with suppress(asyncio.CancelledError):
            await obs_task
        await relay.source_offline()
        await relay.close()


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="SweetFlips OBS + Whisper streamer agent")
    p.add_argument(
        "--config",
        type=Path,
        nargs="?",
        default=None,
        help="Path to streamer_agent.json (default: config/streamer_agent.json if it exists)",
    )
    p.add_argument(
        "--list-devices",
        action="store_true",
        help="List input devices and exit",
    )
    return p.parse_args()


def _resolve_config_path(explicit: Path | None) -> Path:
    if explicit is not None:
        return explicit
    guess = _PROJECT_ROOT / "config" / "streamer_agent.json"
    if guess.is_file():
        return guess
    print(
        "No config: pass --config path/to/streamer_agent.json "
        f"or create {guess}",
        file=sys.stderr,
    )
    raise SystemExit(2)


def main() -> None:
    args = parse_args()
    if args.list_devices:
        print_input_devices()
        raise SystemExit(0)
    if not acquire_streamer_lock():
        print(
            "Another STT streamer is already running "
            "(set STT_ALLOW_MULTIPLE_STREAMERS=1 to override).",
            file=sys.stderr,
        )
        raise SystemExit(1)
    cfg_path = _resolve_config_path(args.config)
    if args.config is None:
        print(f"Using config: {cfg_path}", file=sys.stderr)
    load_dotenv_for_project()
    cfg = load_config(cfg_path)
    setup_logging(cfg)
    try:

        async def _go() -> None:
            stop = asyncio.Event()
            loop = asyncio.get_running_loop()
            for sig in (signal.SIGINT, signal.SIGTERM):
                try:
                    loop.add_signal_handler(sig, stop.set)
                except (NotImplementedError, ValueError):
                    pass
            await run_agent(cfg, stop)

        asyncio.run(_go())
    except KeyboardInterrupt:
        log.info("stopped")


if __name__ == "__main__":
    main()
