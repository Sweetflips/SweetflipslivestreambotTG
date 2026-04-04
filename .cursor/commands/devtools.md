## Local dev (this repo)

- **Relay**: `uvicorn relay_server:app --host 127.0.0.1 --port 8000` with `STT_WS_TOKEN` (or `STT_ALLOW_OPEN_WS=1` for local only).
- **Streamer agent (recommended)**: `python scripts/streamer_obs_whisper_agent.py --config config/streamer_agent.json`
- **Legacy HTTP agent**: `python streamer_agent.py` (uses HTTP ingest; WebSocket JSON agent is preferred).
- Use a virtualenv (`.venv`) and install deps from `requirements.txt` / project docs.
