"""
Thin FastAPI WebSocket relay: /health + /ws/stt (token query param).

Roles (query param ``role``):
  streamer  — sends transcripts and status; relay forwards to listeners.
  listener  — receives transcripts, server pings, streamer_online/offline.

Run (production):
  STT_WS_TOKEN=your_secret uvicorn relay_server:app --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import secrets
import time
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timezone
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

_log_level = getattr(
    logging,
    os.environ.get("STT_LOG_LEVEL", "INFO").strip().upper(),
    logging.INFO,
)
logging.basicConfig(level=_log_level)
logger = logging.getLogger("stt.relay")
logger.setLevel(_log_level)

HEARTBEAT_INTERVAL_S = int(os.environ.get("STT_WS_HEARTBEAT_S", "30"))
PROTO_VERSION = 2
_RELAY_PROCESS_START = time.time()


def _env_flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in ("1", "true", "yes", "on")


def _ws_token() -> str:
    return os.environ.get("STT_WS_TOKEN", "").strip()


def _allow_open_ws() -> bool:
    return _env_flag("STT_ALLOW_OPEN_WS")


def _auth_mode() -> str:
    if _ws_token():
        return "token"
    if _allow_open_ws():
        return "open"
    return "misconfigured"


def _validate_runtime_config() -> None:
    if _auth_mode() == "misconfigured":
        raise RuntimeError(
            "Missing STT_WS_TOKEN. Set STT_WS_TOKEN or explicitly allow open access "
            "with STT_ALLOW_OPEN_WS=1."
        )


MAX_LOG_SUMMARY_CHARS = int(os.environ.get("STT_LOG_SUMMARY_CHARS", "4096"))
MAX_WS_MESSAGE_BYTES = int(os.environ.get("STT_MAX_WS_MESSAGE_BYTES", "65536"))


def _message_log_summary(message: str) -> str:
    if len(message) > MAX_LOG_SUMMARY_CHARS:
        return f"chars={len(message)} summary=skipped_too_large"
    try:
        payload = json.loads(message)
    except json.JSONDecodeError:
        return f"non-json chars={len(message)}"

    msg_type = payload.get("type") or "unknown"
    stream = payload.get("stream_id") or "unknown"
    text = payload.get("text") or ""
    return f"type={msg_type} stream_id={stream} chars={len(message)} text_chars={len(text)}"


def _iso_ts(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def _peer_tag(ws: WebSocket) -> str:
    scope = ws.scope
    client = scope.get("client")
    parts: list[str] = []
    if client and len(client) >= 2:
        parts.append(f"{client[0]}:{client[1]}")
    hdrs = {
        k.decode("latin-1", "ignore").lower(): v.decode("latin-1", "replace")
        for k, v in scope.get("headers", [])
    }
    ua = (hdrs.get("user-agent") or "").strip()
    if ua:
        parts.append(f"ua={ua[:160]}")
    return " ".join(parts) if parts else "unknown"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _validate_runtime_config()
    yield


app = FastAPI(title="STT Relay", lifespan=lifespan)

_clients: set[WebSocket] = set()
_listeners: set[WebSocket] = set()
_streamers: set[WebSocket] = set()
_ws_role: dict[WebSocket, str] = {}
_ws_stream_id: dict[WebSocket, str] = {}
_oversize_messages_total = 0


async def _send_text_safe(ws: WebSocket, message: str) -> WebSocket | None:
    try:
        await ws.send_text(message)
        return None
    except Exception:
        return ws


def _unregister(ws: WebSocket) -> None:
    _clients.discard(ws)
    _listeners.discard(ws)
    _streamers.discard(ws)
    _ws_role.pop(ws, None)
    _ws_stream_id.pop(ws, None)


async def _broadcast_to_listeners(message: str, *, exclude: WebSocket | None = None) -> None:
    recipients = [w for w in _listeners if w is not exclude]
    if not recipients:
        return
    dead = await asyncio.gather(*(_send_text_safe(w, message) for w in recipients))
    for w in dead:
        if w is not None:
            _unregister(w)


def _parse_json_safe(raw: str) -> dict | None:
    try:
        obj = json.loads(raw)
        return obj if isinstance(obj, dict) else None
    except (json.JSONDecodeError, TypeError):
        return None


_CONTROL_TYPES = frozenset({"client_hello", "pong", "ping"})


async def _handle_control_message(ws: WebSocket, payload: dict) -> bool:
    """Returns True if handled (do not forward)."""
    msg_type = (payload.get("type") or "").strip().lower()

    if msg_type == "client_hello":
        sid = payload.get("stream_id")
        if isinstance(sid, str) and sid.strip():
            _ws_stream_id[ws] = sid.strip()
        role = (payload.get("role") or _ws_role.get(ws, "listener")).strip().lower()
        if role == "streamer":
            _listeners.discard(ws)
            _streamers.add(ws)
            _ws_role[ws] = "streamer"
        else:
            _streamers.discard(ws)
            _listeners.add(ws)
            _ws_role[ws] = "listener"
        logger.info(
            "client_hello stream_id=%s role=%s",
            sid or "(none)",
            _ws_role[ws],
        )
        if role == "streamer" and isinstance(sid, str) and sid.strip():
            await _broadcast_to_listeners(
                json.dumps(
                    {
                        "type": "streamer_online",
                        "stream_id": sid.strip(),
                        "ts": time.time(),
                    },
                    ensure_ascii=False,
                )
            )
        return True

    if msg_type in _CONTROL_TYPES:
        return True

    return False


def streamer_online() -> bool:
    return len(_streamers) > 0


def _primary_stream_id() -> str:
    """Best-effort stream_id for broadcasts when multiple streamers (first in set)."""
    for ws in _streamers:
        sid = _ws_stream_id.get(ws)
        if sid:
            return sid
    return "unknown"


@app.get("/health")
async def health():
    streamer_list: list[dict[str, str]] = []
    for ws in _streamers:
        sid = _ws_stream_id.get(ws)
        if not sid:
            continue
        streamer_list.append({"stream_id": sid})
    now = time.time()
    return {
        "status": "ok",
        "service": "stt-relay",
        "proto": PROTO_VERSION,
        "process_started_unix": _RELAY_PROCESS_START,
        "uptime_seconds": round(now - _RELAY_PROCESS_START, 3),
        "connected_clients": len(_clients),
        "listeners": len(_listeners),
        "streamers_connected": len(_streamers),
        "streamer_online": streamer_online(),
        "auth_mode": _auth_mode(),
        "streamers": streamer_list,
        "oversize_messages_dropped_total": _oversize_messages_total,
    }


@app.websocket("/ws/stt")
async def stt_socket(websocket: WebSocket):
    global _oversize_messages_total

    _validate_runtime_config()
    token = websocket.query_params.get("token")
    expected = _ws_token()
    if expected:
        if not token or len(token) != len(expected):
            await websocket.close(code=1008)
            return
        if not secrets.compare_digest(token, expected):
            await websocket.close(code=1008)
            return

    await websocket.accept()

    role = (websocket.query_params.get("role") or "listener").strip().lower()
    _clients.add(websocket)
    _ws_role[websocket] = role
    if role == "streamer":
        _streamers.add(websocket)
    else:
        _listeners.add(websocket)

    logger.info(
        "client connected role=%s peer=%s (%d total)",
        role,
        _peer_tag(websocket),
        len(_clients),
    )

    welcome = json.dumps(
        {
            "type": "welcome",
            "proto": PROTO_VERSION,
            "role": role,
            "streamer_online": streamer_online(),
            "server_time": time.time(),
        }
    )
    try:
        await websocket.send_text(welcome)
    except Exception:
        _unregister(websocket)
        return

    stop = asyncio.Event()

    async def _heartbeat() -> None:
        while not stop.is_set():
            try:
                await asyncio.wait_for(stop.wait(), timeout=HEARTBEAT_INTERVAL_S)
                return
            except asyncio.TimeoutError:
                pass
            try:
                await websocket.send_text(json.dumps({"type": "ping", "ts": time.time()}))
            except Exception:
                stop.set()
                return

    async def _receive() -> None:
        try:
            while not stop.is_set():
                raw = await websocket.receive_text()
                if len(raw) > MAX_WS_MESSAGE_BYTES:
                    _oversize_messages_total += 1
                    logger.warning(
                        "dropped oversize websocket message: %d bytes (max %d)",
                        len(raw),
                        MAX_WS_MESSAGE_BYTES,
                    )
                    continue

                payload = _parse_json_safe(raw)
                if payload is not None:
                    if await _handle_control_message(websocket, payload):
                        continue
                    sid = payload.get("stream_id")
                    if isinstance(sid, str) and sid.strip():
                        _ws_stream_id[websocket] = sid.strip()

                if _ws_role.get(websocket) != "streamer":
                    continue

                logger.info("rx %s", _message_log_summary(raw))
                await _broadcast_to_listeners(raw, exclude=websocket)
        except WebSocketDisconnect:
            pass
        except Exception:
            logger.exception("websocket receive loop error peer=%s", _peer_tag(websocket))
        finally:
            stop.set()

    heartbeat_task = asyncio.create_task(_heartbeat())
    receive_task = asyncio.create_task(_receive())

    try:
        await receive_task
    finally:
        stop.set()
        heartbeat_task.cancel()
        with suppress(asyncio.CancelledError):
            await heartbeat_task

        was_streamer = websocket in _streamers
        sid = _ws_stream_id.get(websocket) or _primary_stream_id()
        peer = _peer_tag(websocket)
        _unregister(websocket)

        if was_streamer and not streamer_online():
            await _broadcast_to_listeners(
                json.dumps(
                    {
                        "type": "streamer_offline",
                        "stream_id": sid,
                        "ts": time.time(),
                    },
                    ensure_ascii=False,
                )
            )

        logger.info(
            "client disconnected peer=%s (%d remaining)",
            peer,
            len(_clients),
        )


if __name__ == "__main__":
    import uvicorn

    try:
        port = int(os.environ.get("PORT", "8000"))
    except ValueError as e:
        raise SystemExit(f"Invalid PORT: {e}") from e

    uvicorn.run(
        "relay_server:app",
        host="127.0.0.1",
        port=port,
        reload=False,
        ws_ping_interval=20,
        ws_ping_timeout=20,
    )
