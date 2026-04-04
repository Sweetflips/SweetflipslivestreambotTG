# Fast Whisper 2 — Streamer voice STT



Local microphone on the streamer PC → **faster-whisper** (CUDA, default `large-v3`) → **outbound HTTPS POST** to the SweetFlips relay (`/source/online`, `/source/offline`, `/ingest`). No inbound ports on the streamer machine.



## Layout



| Where | Runs |

| --- | --- |

| Streamer PC (NVIDIA GPU) | `streamer_agent.py` (24/7), optional OBS WebSocket for stream on/off |

| VPS | Relay (HTTP ingest + optional WebSocket for bots) + Nginx + TLS |

| Bot | Consumes relay API (HTTP and/or WebSocket depending on deployment) |



## Streamer PC setup



1. Create a venv and install dependencies (install PyTorch with CUDA from [pytorch.org](https://pytorch.org) first):



   ```powershell

   cd "c:\Users\nicks\Documents\Fast Whisper 2"

   python -m venv .venv

   .\.venv\Scripts\pip install -r requirements.txt

   ```



2. Copy `.env.example` to `.env` and set at least `STT_RELAY_URL`, `STT_SOURCE_NAME`, and OBS settings if you use OBS.



3. Run the agent:



   ```powershell

   .\.venv\Scripts\python streamer_agent.py

   ```



### JSON config agent (`scripts/streamer_obs_whisper_agent.py`)



Copy `config/streamer_agent.example.json` to `config/streamer_agent.json`, set relay and OBS fields (the real config file is gitignored). **OBS:** Put secrets in **`.env`** at the project root (`OBS_WS_HOST`, `OBS_WS_PORT`, `OBS_WS_PASSWORD` — same as `streamer_agent.py`). Leave `"password": ""` in JSON. The agent loads that `.env` with **override enabled** so file values replace empty or placeholder variables from Task Scheduler or the shell.

**GPU VRAM (JSON `whisper`):** Default **`compute_type`** is **`int8`** (full 8‑bit quantization via CTranslate2; lowest VRAM vs `float16`). For a quality/speed middle ground, use **`int8_float16`** (8‑bit weights, float16 activations). Defaults also use **`beam_size` / `best_of` = 1** (library default `best_of` is 5, which uses extra memory). For higher accuracy at the cost of VRAM, set `compute_type` to `float16`, `beam_size` to `2`, and `best_of` to `2`. You can also use a smaller **`model_size`** (e.g. `medium` or `small`) or lower **`audio.max_buffer_secs`**.

Install streamer-only dependencies:



```powershell

.\.venv\Scripts\pip install -r requirements-streamer-agent.txt

.\.venv\Scripts\python scripts\streamer_obs_whisper_agent.py --config config\streamer_agent.json

```



List input devices: `python scripts\streamer_obs_whisper_agent.py --list-devices`



**Testing while not live (no Twitch/YouTube broadcast):** By default, when OBS is connected and the stream output is off, the agent stops transcription. Use either:



- `"obs": { "enabled": false }` — no OBS WebSocket; always transcribe (simplest for bench tests).
- `"obs": { "require_stream_active": false }` — keep OBS enabled and password set, but still transcribe and send to the relay even when you are not live (set back to `true` when you want gating only while broadcasting).



The streamer PC talks to the relay **only with HTTP POST** to `relay.base_url` (no token, no WebSocket handshake). **`STT_RELAY_URL` or `RELAY_BASE_URL` in `.env` overrides** `relay.base_url` in JSON. On startup the agent **GETs `/health`** on that host (unless `relay.health_check_on_start` is false) so logs show **“Connected to relay host …”** when the server is reachable. Paths: `/source/online`, `/ingest`, `/source/offline`. Example (PowerShell, `source_name` must match `relay.source_name` in JSON):



```powershell

curl.exe -X POST http://62.45.124.91:8766/source/online `

  -H "content-type: application/json" `

  -d "{\"source_name\":\"streamer-pc\"}"



curl.exe -X POST http://62.45.124.91:8766/ingest `

  -H "content-type: application/json" `

  -d "{\"type\":\"transcript\",\"text\":\"what slot after this\",\"is_final\":true,\"timestamp\":1712080000.0,\"source\":\"streamer-pc\"}"



curl.exe -X POST http://62.45.124.91:8766/source/offline `

  -H "content-type: application/json" `

  -d "{\"source_name\":\"streamer-pc\"}"

```



**Task Scheduler (Windows, run at log on):**



- Trigger: At log on
- Action: Start a program — Program: `C:\path\.venv\Scripts\python.exe` — Arguments: `C:\path\scripts\streamer_obs_whisper_agent.py --config C:\path\config\streamer_agent.json`
- Settings: Restart on failure every 1 minute, up to 999 times



## Relay (VPS) — WebSocket debug



For local WebSocket testing against [`relay_server.py`](relay_server.py):



```env

STT_ALLOW_OPEN_WS=1

STT_WS_URL=ws://127.0.0.1:8000/ws/stt

```



Then run `uvicorn relay_server:app` and `listen_stt_ws.py` as a listener.



## Production (VPS)



1. Copy `relay_server.py`, `ws_config.py`, `requirements.txt` to e.g. `/opt/stt`.

2. Create venv, `pip install -r requirements.txt` (relay only needs FastAPI stack; no faster-whisper on the server).

3. Set `STT_WS_TOKEN` in `/etc/stt.env` (see `deploy/systemd/stt.env.example`).

4. Install `deploy/systemd/stt.service` and enable the service.

5. Install Nginx, use `deploy/nginx/stt.sweetflips.ai.conf`, obtain TLS with certbot.

6. On the streamer PC, set `STT_RELAY_URL=https://stt.sweetflips.ai` (or your host).



## OBS



Enable **WebSocket server** in OBS (Tools → WebSocket Server Settings). Match `OBS_WS_HOST`, `OBS_WS_PORT`, and `OBS_WS_PASSWORD` in `.env`. When OBS is unreachable or `OBS_WS_ENABLED=0`, transcription stays **on** (always active).



## Protocol (streamer agent)



- `POST /source/online` — `{ "source_name": "<STT_SOURCE_NAME>" }` when going live

- `POST /ingest` — `{ "type": "transcript", "text": "...", "is_final": true, "timestamp": <unix>, "source": "<name>" }`

- `POST /source/offline` — same body as online when stream stops



WebSocket protocol for `listen_stt_ws.py` / bot listeners is separate; see `relay_server.py`.
