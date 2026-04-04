"""
Connect as role=listener and print every WebSocket text frame as formatted JSON.

Requires the same .env as other STT clients: STT_WS_TOKEN, optional STT_WS_URL override.

Usage:
  python listen_stt_ws.py
"""

from __future__ import annotations

import asyncio
import json
import sys

import websockets

from ws_config import websocket_url, websocket_url_for_log

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]


def _print_frame(raw: str) -> None:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        print(raw, flush=True)
        return
    print(json.dumps(data, ensure_ascii=False, indent=2), flush=True)
    if data.get("type") == "ai_trigger":
        print(
            "  --- metrics: "
            f"volume_db={data.get('volume_db')!r} "
            f"avg_logprob={data.get('avg_logprob')!r} "
            f"no_speech_prob={data.get('no_speech_prob')!r}",
            flush=True,
        )


async def _run() -> None:
    url = websocket_url(role="listener")
    safe = websocket_url_for_log(url)
    print(f"Listening (raw JSON): {safe}", flush=True)
    while True:
        try:
            async with websockets.connect(
                url,
                ping_interval=20,
                ping_timeout=60,
            ) as ws:
                async for message in ws:
                    if isinstance(message, bytes):
                        print(f"[binary {len(message)} bytes]", flush=True)
                        continue
                    _print_frame(message)
        except (OSError, websockets.exceptions.WebSocketException) as e:
            print(f"Disconnected: {e}. Reconnecting in 2s...", flush=True)
            await asyncio.sleep(2.0)


def main() -> None:
    try:
        asyncio.run(_run())
    except KeyboardInterrupt:
        print("Stopped.", flush=True)


if __name__ == "__main__":
    main()
