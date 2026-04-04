"""
SweetFlips streamer PC: mic → faster-whisper (CUDA) → POST /ingest on relay.
JSON config, OBS stream on/off, 24/7 process, outbound HTTPS only.

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

import httpx
import numpy as np
import sounddevice as sd
from dotenv import load_dotenv
from faster_whisper import WhisperModel

_PROJECT_ROOT = Path(__file__).resolve().parent.parent

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]

for _k, _v in (("OMP_NUM_THREADS", "4"), ("MKL_NUM_THREADS", "4"), ("OPENBLAS_NUM_THREADS", "4")):
    os.environ.setdefault(_k, _v)

POST_MAX_ATTEMPTS = 5
BACKOFF_CAP_S = 30.0
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


def print_input_devices() -> None:
    print("Input devices (max_input_channels > 0):")
    for i, dev in enumerate(sd.query_devices()):
        if int(dev["max_input_channels"]) <= 0:
            continue
        print(f"  {i}: {dev['name']}")


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


class RelayClient:
    def __init__(self, cfg: dict[str, Any]) -> None:
        r = cfg["relay"]
        self._base = relay_base_url(cfg)
        self._source_name = str(r["source_name"]).strip() or "streamer-pc"
        self._timeout = float(r.get("timeout_secs") or 5.0)
        self._backoff_base = float(r.get("retry_backoff_secs") or 3.0)
        self._client = httpx.AsyncClient(timeout=self._timeout)
        self._last_utterance_id: int | None = None

    @property
    def base_url(self) -> str:
        return self._base

    async def check_health(self) -> bool:
        """GET /health on the relay host (stream-stt-relay)."""
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
                        "Connected to relay host %s (service=%s ok=%s)",
                        self._base,
                        data.get("service", "?"),
                        data.get("ok"),
                    )
                else:
                    log.info("Connected to relay host %s", self._base)
            except Exception:
                log.info("Connected to relay host %s (health body not JSON)", self._base)
            return True
        except httpx.HTTPError as e:
            log.warning("Cannot reach relay host at %s: %s", self._base, e)
            return False

    async def post(self, path: str, payload: dict) -> bool:
        url = f"{self._base}{path}"
        attempt = 0
        backoff = self._backoff_base
        while attempt < POST_MAX_ATTEMPTS:
            try:
                r = await self._client.post(url, json=payload)
                if r.status_code < 300:
                    return True
                log.warning("relay %s -> %s", path, r.status_code)
            except httpx.HTTPError as e:
                log.warning("relay %s failed: %s (attempt %s)", path, e, attempt + 1)
            attempt += 1
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, BACKOFF_CAP_S)
        log.error("relay %s: gave up after %s attempts", path, attempt)
        return False

    async def source_online(self) -> bool:
        return await self.post(
            "/source/online", {"source_name": self._source_name}
        )

    async def source_offline(self) -> bool:
        return await self.post(
            "/source/offline", {"source_name": self._source_name}
        )

    async def ingest(self, text: str, ts: float, utterance_id: int | None) -> bool:
        if utterance_id is not None and utterance_id == self._last_utterance_id:
            return True
        body: dict[str, Any] = {
            "type": "transcript",
            "text": text,
            "is_final": True,
            "timestamp": ts,
            "source": self._source_name,
        }
        ok = await self.post("/ingest", body)
        if ok and utterance_id is not None:
            self._last_utterance_id = utterance_id
        return ok

    async def close(self) -> None:
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
        await asyncio.sleep(interval)


def _normalize_dedup(t: str) -> str:
    return " ".join(t.lower().strip().split())


def _normalize_phrase(t: str) -> str:
    """Lowercase, strip whitespace and trailing punctuation — used for phrase matching."""
    return " ".join(t.lower().strip().rstrip(".!?").split())


# --- Vocabulary normalization ------------------------------------------------
# Whisper commonly mishears these streamer names, brands, and slot/casino terms.
# Each entry: (compiled regex, canonical replacement).
# Patterns are case-insensitive and word-bounded.

def _w(pattern: str, canonical: str) -> tuple[re.Pattern[str], str]:
    return (re.compile(r"(?i)\b(?:" + pattern + r")\b"), canonical)


def _wp(pattern: str, canonical: str) -> tuple[re.Pattern[str], str]:
    """Phrase pattern (may contain spaces)."""
    return (re.compile(r"(?i)" + pattern), canonical)


_VOCAB_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    # --- Mascoobs (brand) — Whisper often says mascopes, mascop, mass scopes, etc. ---
    _wp(r"\bmy\s+scoops?,?\s*my\s+scupes?\b", "Mascoobs"),
    _wp(r"\bmy\s+scupes?,?\s*my\s+scoops?\b", "Mascoobs"),
    _wp(r"\bm[ua]s+c?o{1,2}ps?\s*,\s*m[ua]s+c?o{1,2}ps?\b", "Mascoobs"),
    _wp(r"\bmass\s+scopes?\b", "Mascoobs"),
    _wp(r"\bmass\s+coops?\b", "Mascoobs"),
    _wp(r"\bmas\s+co{1,2}bs?\b", "Mascoobs"),
    _wp(r"\bmass\s+co{1,2}bs?\b", "Mascoobs"),
    _wp(r"\bmask\s+co{1,2}bs?\b", "Mascoobs"),
    _w(
        r"mascopes?|mascop|mascops|mascubes?|mascobes?|mascoups?|"
        r"m[ua]s+copes?|m[ua]s+cop\b|m[ua]s+cops\b|"
        r"m[ua]s+c?o{1,2}ps?|m[ua]ssc+oops?|mucscoops?|musscoops?|muscoops|mascoops|"
        r"mus+copes?|muskopes?",
        "Mascoobs",
    ),

    # --- CSgoWin (incl. "cheese go win" mishear) ---
    _wp(r"\bcheese\s+go\s+win\b|\bchees\s+go\s+win\b", "CSgoWin"),
    _w(r"cs\s*go\s*win|csgo\s*win|cs\s*go\s*when|csg[oa]\s*wi?n", "CSgoWin"),

    # --- LuxDrop ("Lux Drops", "Looks drop") ---
    _wp(r"\blux\s+drops?\b", "LuxDrop"),
    _wp(r"\blooks?\s+drop\b", "LuxDrop"),
    _w(r"lux\s*drop|luxe?\s*drop|lucks?\s*drop|lux\s*tr[oa]p", "LuxDrop"),

    # --- Spartans ---
    _w(r"spart[ae]ns?|spartan's", "Spartans"),

    # --- Sweetflips ---
    _w(r"sweet\s*flips?|swee?t\s*fl[ie]ps?|suite?\s*flips?", "Sweetflips"),

    # --- Nico ---
    _w(r"n[iy]c+[ko]|neek[ao]|nikko|nee?co", "Nico"),

    # --- Amor ---
    _w(r"am[ao]r|a\s*more?|amour", "Amor"),

    # --- Danny ---
    _w(r"dann[iy]e?|denn[iy]e?|denny", "Danny"),

    # --- Kazlic ---
    _w(r"kazl[iy]c?k?|kasl[iy]ck?|cazl[iy]ck?|kaz+l[iy]k", "Kazlic"),

    # --- Boomer / Boomer song ---
    _wp(r"\bboome?r\s+song\b", "Boomer song"),
    _w(r"boome?rs?|boo?mme?rs?", "Boomer"),

    # --- Slot / casino terms ---
    _w(r"bonus\s*hunt|bonush[ua]nt", "Bonushunt"),
    _wp(r"\bbonus\s+open(?:ing|ings?)?\b", "Bonus opening"),
    _w(r"up\s*gr[ae]de?r|upgrader", "Upgrader"),
    _w(r"wi?lds?", "Wilds"),
    _wp(r"\bmax\s+wi?ns?\b", "Max win"),

    # --- Short / exact terms (simple case-fix, no fuzzy needed) ---
    _w(r"VIP", "VIP"),
    _w(r"spam", "Spam"),
    _w(r"send", "Send"),
    _w(r"WW|w\s*w", "WW"),
    _w(r"boxes|box", "Boxes"),
    _w(r"bonus", "Bonus"),
    _w(r"BANG|bang", "BANG"),

    # --- Slot providers ---
    _wp(r"\bpragmatic\s+play\b", "Pragmatic Play"),
    _wp(r"\bpreg\s*matic\b", "Pragmatic"),
    _w(r"pregmatic|pragmatic|pragmaticplay", "Pragmatic"),
    _wp(r"\bhax(?:or|xor)\s+gaming\b", "Hacksaw Gaming"),
    _w(r"hacksaw|hack\s*saw|hacksaw\s*gaming|hax(?:or|xor)|haxsaw", "Hacksaw"),
    _wp(r"\bno\s*-?\s*limit\s+city\b", "Nolimit City"),
    _w(r"nolimit|no\s*-?\s*limit|no\s+limit", "Nolimit"),
    # --- Pragmatic Play — flagship / frequent titles (phrase fixes) ---
    # Longer titles first so "… 1000" is not split.
    _wp(r"\bgates?\s+of\s+olympus\s+1000\b", "Gates of Olympus 1000"),
    _wp(
        r"\bgates?\s+of\s+olympus\s+super\s+scatter\b",
        "Gates of Olympus Super Scatter",
    ),
    _wp(
        r"\bgates?\s+of\s+ol[yi]mp(?:us|is|ics|ix)\b",
        "Gates of Olympus",
    ),
    _wp(r"\bsweet\s+b[ao]n[ae]nz[ao]\s+1000\b", "Sweet Bonanza 1000"),
    _wp(r"\bsweet\s+b[ao]n[ae]nz[ao]\b", "Sweet Bonanza"),
    _wp(r"\bstar\s*light\s+princess\s+1000\b", "Starlight Princess 1000"),
    _wp(r"\bstar\s*light\s+princess\b", "Starlight Princess"),
    _wp(r"\bsugar\s+rush\s+1000\b", "Sugar Rush 1000"),
    _wp(r"\bbig\s+bass\s+b[ao]n[ae]nz[ao]\b", "Big Bass Bonanza"),
    _wp(r"\bbig\s+bass\s+raceday\s+repeat\b", "Big Bass Raceday Repeat"),
    _wp(r"\bsugar\s+rush\b", "Sugar Rush"),
    _wp(r"\bmustang\s+gold\b", "Mustang Gold"),
    _wp(r"\bwild\s+west\s+gold\b", "Wild West Gold"),
    _wp(r"\bgreat\s+rhino\b", "Great Rhino"),
    _wp(r"\bjelly\s+express\b", "Jelly Express"),
    _wp(r"\bsnow\s+party\b", "Snow Party"),
    _wp(r"\bsteamin['\u2019]?\s*reels?\b", "Steamin' Reels"),
    # --- Hacksaw Gaming — official-style titles (conservative phrases) ---
    _wp(r"\bepic\s+bullets?\s+and\s+bounty\b", "Epic Bullets and Bounty"),
    # Non-epic variant after epic so both match intended title
    _wp(r"\bbullets?\s+and\s+bounty\b", "Bullets and Bounty"),
    _wp(r"\ble\s+bunny\b", "Le Bunny"),
    _wp(r"\bdusk\s+princess\b", "Dusk Princess"),
    _wp(r"\brainbow\s+princess\b", "Rainbow Princess"),
    _wp(r"\bchaos\s+crew\s*3\b", "Chaos Crew 3"),
    _wp(r"\bmiami\s+mayhem\b", "Miami Mayhem"),
    _wp(r"\bzeus\s+ze\s+zec(?:ond|on|o)\b", "Zeus Ze Zecond"),
    _wp(r"\bmarlin\s+masters?\b", "Marlin Masters: The Big Haul"),
    # --- Nolimit City — flagship titles ---
    _wp(
        r"\bsan\s+quentin\s+2\b",
        "San Quentin 2: Death Row",
    ),
    _wp(r"\bsan\s+quentin\b", "San Quentin"),
    _wp(r"\btombstone\s+(?:r\.?i\.?p\.?|rip)\b", "Tombstone RIP"),
    _wp(r"\bfire\s+in\s+the\s+hole\b", "Fire in the Hole"),
    _wp(r"\bdas\s+x\s*boot\s+2\b|das\s*x\s*boot\s+2\b", "Das xBoot 2wei"),
    _wp(r"\bdas\s+x\s*boot\b|das\s*x\s*boot\b|doss\s+x\s*boot\b", "Das xBoot"),
    _wp(r"\bdeadwood\b", "Deadwood"),
    _wp(
        r"\bplay\s*n\s*go\b|play'?n'?go|playngo|play\s+and\s+go|play\s+ngo",
        "Play'n GO",
    ),
    _w(r"b\s*-?\s*gaming|bgaming|bee\s+gaming|bee\s*gaming", "BGaming"),

    # --- Originals (Keno, Limbo, Dice, Mines, Plinko) ---
    _w(r"keeno|kino", "Keno"),
    _w(r"limbo", "Limbo"),
    _w(r"dyce|dyse|\bdice\b", "Dice"),
    _w(r"mines|mine'?s\s+game|mines\s+game", "Mines"),
    _w(r"plinko|plincko|plink[oa]|plinco", "Plinko"),

    # --- Social platforms (YouTube, Instagram, Discord, Telegram, X, Twitter) ---
    _w(r"youtubers", "YouTubers"),
    _w(r"youtuber", "YouTuber"),
    _w(r"youtube|you\s*-?\s*tube|u\s*-?\s*tube", "YouTube"),
    _w(r"instagram|instagrahm|insta\.?gram|\binsta\b", "Instagram"),
    _w(r"discord|discorde|discoard", "Discord"),
    _w(r"telegram|telegrm|tele\s*-?\s*gram", "Telegram"),
    _w(r"twitter|twittter|twiter|twitta", "Twitter"),
    # X (rebrand): phonetic "eks" after "on" (Whisper often writes "eks" for the letter X)
    _wp(r"\bon\s+eks\b", "on X"),
]


def _normalize_vocab(text: str) -> str:
    if not (text or "").strip():
        return text
    t = text.strip()
    # Two passes: fixes like "Lux Drops" → LuxDrop then nearby words can align
    for _ in range(2):
        for pat, repl in _VOCAB_PATTERNS:
            t = pat.sub(repl, t)
    t = re.sub(r"\s{2,}", " ", t).strip()
    return t


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
) -> tuple[str, list]:
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
    try:
        segments, _info = model.transcribe(
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
            **tc_extra,
        )
    except Exception as e:
        log.exception("transcribe failed: %s", e)
        return "", []
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
    return text, segs


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
        "Model ready. Relay host %s source=%s",
        relay.base_url,
        cfg["relay"]["source_name"],
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
                text, whisper_segs = await asyncio.to_thread(transcribe_sync, model, final, cfg)
                if not text or len(text.strip()) < min_chars:
                    continue
                text = _normalize_vocab(text)
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
                await relay.ingest(text, ts, seg.utterance_id)
    finally:
        obs_task.cancel()
        with suppress(asyncio.CancelledError):
            await obs_task
        await relay.source_offline()
        await relay.close()


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="SweetFlips OBS + Whisper streamer agent")
    p.add_argument("--config", type=Path, help="Path to streamer_agent.json")
    p.add_argument(
        "--list-devices",
        action="store_true",
        help="List input devices and exit",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    if args.list_devices:
        print_input_devices()
        raise SystemExit(0)
    if not args.config:
        print("--config is required (unless --list-devices)", file=sys.stderr)
        raise SystemExit(2)
    load_dotenv_for_project()
    cfg = load_config(args.config)
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
