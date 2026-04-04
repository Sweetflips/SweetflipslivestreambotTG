## Process management

- Run the relay with `uvicorn` (see README / `devtools` command). Use a single relay process per host unless you know you need HA.
- Run only one streamer agent per GPU: the OBS Whisper agent acquires a mutex/flock by default (`STT_ALLOW_MULTIPLE_STREAMERS=1` to override for debugging).
- Do not commit log files, PID files, or `.env` with secrets.
- Prefer explicit config (`config/streamer_agent.json`) plus env overrides for deployment.
