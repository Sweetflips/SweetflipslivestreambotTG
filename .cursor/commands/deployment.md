## Deployment notes

- **Relay**: deploy `relay_server.py` behind HTTPS if exposed; require `STT_WS_TOKEN` in production; set `PORT` as the host expects.
- **Streamer PC**: runs the Whisper agent with CUDA; keep drivers and `faster-whisper` deps aligned with the README.
- **Railway / PaaS**: use env vars for tokens and URLs; do not bake secrets into JSON committed to git.
- Health check: `GET /health` includes uptime (`process_started_unix`, `uptime_seconds`) for monitors.
