## Product features (this repo)

- **STT pipeline**: mic → faster-whisper → optional filters → WebSocket relay (`relay_server.py`) for overlays/listeners.
- **OBS gating**: optional “only transcribe when live” via OBS WebSocket (`scripts/streamer_obs_whisper_agent.py`).
- **Single GPU**: `stt_single_instance.acquire_streamer_lock()` avoids two Whisper processes fighting for CUDA.
- **Vocabulary**: shared corrections in `transcript_normalization.py` for brand/slot terms.
