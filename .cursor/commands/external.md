## Integrations and secrets

- **Relay WebSocket**: keep `STT_WS_TOKEN` in environment or `.env` (never commit real tokens). Prefer `STT_ALLOW_OPEN_WS=1` only on trusted localhost.
- **OBS WebSocket**: store `OBS_WS_PASSWORD` in `.env`; do not commit live credentials.
- **Env overrides**: `STT_RELAY_URL`, `STT_STREAM_ID`, and related vars override JSON config — document changes when adding new knobs.
- Log errors from outbound calls; use retries/backoff where the code already does (relay connect, OBS polling).
