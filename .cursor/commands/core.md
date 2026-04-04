## Core practices (Python STT repo)

- Prefer **`pip`** / **`requirements.txt`** (and `requirements-streamer-agent.txt`) for dependencies; use a venv (`.venv`).
- Do not commit **`.env`**, API tokens, or OBS passwords; use **`.env.example`** as documentation.
- Avoid blocking calls on async code paths; use `asyncio.to_thread` for Whisper inference where appropriate.
- Keep secrets out of JSON config files; use env overrides for relay URLs and WebSocket tokens.
