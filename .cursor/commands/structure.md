## Project layout (this repo)

- **Root Python:** `streamer_agent.py`, `relay_server.py`, `listen_stt_ws.py`, `ws_config.py`, helpers (`stt_*.py`, `transcript_normalization.py`, `emotion_laughter.py`).
- **`scripts/`:** `streamer_obs_whisper_agent.py` (config-driven streamer).
- **`config/`:** `streamer_agent.example.json` (copy to gitignored `streamer_agent.json`).
- **`deploy/`:** systemd + nginx for the STT relay VPS.

## Practices

- Do not commit secrets (`.env`, real passwords); use `.env.example` as a template.
- Keep relay concerns in `relay_server.py`; streamer logic in `streamer_agent.py` / `scripts/streamer_obs_whisper_agent.py`.
- Prefer configuration via JSON + env overrides rather than hardcoding hosts or tokens.
