"""
Public STT WebSocket URL (Nginx TLS -> relay on VPS).

Set STT_WS_TOKEN in the environment on streamer, relay, and listener (same value).
Set STT_STREAM_ID on each streamer machine. If unset, DEFAULT_STREAM_ID is used.
Optional: STT_WS_URL=http://... or wss://... to override (local dev).
"""

from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlencode

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

STT_PUBLIC_HOST = os.environ.get("STT_PUBLIC_HOST", "stt.sweetflips.ai").strip()
STT_WS_PATH = "/ws/stt"
DEFAULT_STREAM_ID = "Nick"


def stream_id() -> str:
    value = os.environ.get("STT_STREAM_ID", "").strip()
    return value or DEFAULT_STREAM_ID


def websocket_url(*, role: str = "") -> str:
    token = os.environ.get("STT_WS_TOKEN", "").strip()
    override = os.environ.get("STT_WS_URL", "").strip()
    if override:
        if token and "token=" not in override:
            sep = "&" if "?" in override else "?"
            override = f"{override}{sep}{urlencode({'token': token})}"
        if role and "role=" not in override:
            sep = "&" if "?" in override else "?"
            override = f"{override}{sep}{urlencode({'role': role})}"
        return override
    scheme = "wss"
    base = f"{scheme}://{STT_PUBLIC_HOST}{STT_WS_PATH}"
    params: dict[str, str] = {}
    if token:
        params["token"] = token
    if role:
        params["role"] = role
    if params:
        return f"{base}?{urlencode(params)}"
    return base


def websocket_url_for_log(url: str) -> str:
    """Safe to print (hides token query value)."""
    if "token=" not in url:
        return url
    base, _, _ = url.partition("?")
    return f"{base}?token=***"
