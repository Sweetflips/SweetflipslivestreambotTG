## HTTP / realtime

- **`relay_server.py`** uses **FastAPI** + **WebSocket** (`/ws/stt`). Keep transcript forwarding logic there; keep the streamer client in `scripts/streamer_obs_whisper_agent.py`.
- Use **environment variables** for `STT_WS_TOKEN`, `PORT`, and logging.
