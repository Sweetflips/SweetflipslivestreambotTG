# Fast Whisper 2 — Streamer voice STT

Streamer PC: **microphone** → **faster-whisper** (CUDA) → **WebSocket** to [`relay_server.py`](relay_server.py) (`/ws/stt`, `role=streamer`). Optional **OBS WebSocket** gates transcription when the stream is live. No inbound ports required on the streamer.

## Repo layout

| Piece | Role |
| --- | --- |
| `streamer_agent.py` | Single-file agent (env-driven); HTTP-era relay option if you still run an old ingest service |
| `scripts/streamer_obs_whisper_agent.py` | **Recommended:** JSON config + WebSocket transcripts + rich JSON payload |
| `relay_server.py` | FastAPI: `GET /health`, `WebSocket /ws/stt` (listeners get transcripts) |
| `listen_stt_ws.py` | Debug listener (prints JSON frames) |
| `ws_config.py` | Builds `wss://…/ws/stt?token=…` for clients |
| `deploy/` | systemd + nginx samples for the relay VPS |

## Streamer PC setup

1. Install PyTorch with CUDA from [pytorch.org](https://pytorch.org), then:

   ```powershell
   cd "c:\Users\nicks\Documents\Fast Whisper 2"
   python -m venv .venv
   .\.venv\Scripts\pip install -r requirements-streamer-agent.txt
   ```

2. Copy `.env.example` to `.env`. Set **`STT_RELAY_URL`** (HTTP base for `/health`), **`STT_WS_TOKEN`** (same secret as the relay), and OBS vars if you use OBS gating.

3. Copy `config/streamer_agent.example.json` → `config/streamer_agent.json` (gitignored) and tune `relay`, `audio`, `whisper`, `obs`.

4. Run (optional `--config` if `config\streamer_agent.json` exists):

   ```powershell
   .\.venv\Scripts\python scripts\streamer_obs_whisper_agent.py --config config\streamer_agent.json
   ```

   Same as above without `--config` when that file is present.

List mics: `python scripts\streamer_obs_whisper_agent.py --list-devices`

### Testing without going live

- `"obs": { "enabled": false }` — always transcribe (no OBS).
- `"obs": { "require_stream_active": false }` — OBS connected but transcribe even when not broadcasting.

### GPU / VRAM

In JSON `whisper`: default **`compute_type`** **`int8`** keeps VRAM low; **`int8_float16`** or **`float16`** trades memory for quality. Raising **`beam_size`** / **`best_of`** uses more VRAM.

## Relay (VPS)

1. Deploy `relay_server.py` with uvicorn (see `deploy/systemd/stt.service` and `deploy/systemd/stt.env.example`).
2. Set **`STT_WS_TOKEN`** on both relay and streamer (or `STT_ALLOW_OPEN_WS=1` for local dev only).
3. TLS: `deploy/nginx/stt.sweetflips.ai.conf` as a starting point.

### Docker (relay)

Copy `.env.example` to `.env` and set **`STT_WS_TOKEN`** (shared with streamers). If you omit it, `docker-compose.yml` uses a **dev default** (`changeme`) so the container starts — **change this for any shared or public deployment**. With [Docker Desktop](https://www.docker.com/products/docker-desktop/) running:

```powershell
docker compose build
docker compose up -d
```

To join this host as a **Swarm worker** (after the manager issues a join token):

```powershell
.\scripts\Test-SwarmConnectivity.ps1 -Manager 'YOUR_MANAGER_IP:2377'
.\scripts\Join-DockerSwarm.ps1 -Token '<worker-token>' -Manager 'YOUR_MANAGER_IP:2377'
```

You can set **`SWARM_MANAGER`** instead of passing **`-Manager`** each time. Optional: **`-AdvertiseAddr`** if the manager must see a specific interface IP (multi-homed / VPN).

If a join fails or `docker info` shows **Swarm: error**, clear local state and fix reachability first:

```powershell
.\scripts\Leave-DockerSwarm.ps1 -Force
```

**Swarm troubleshooting:** The worker must reach the manager on **TCP 2377** (often same VPN or LAN as the manager). Ping can fail even when TCP works (ICMP blocked). **Docker Desktop** can join a remote swarm but networking must allow the Linux engine to route to the manager. Do not use Linux-only install lines such as `curl https://get.docker.com | sh` in PowerShell; use Docker Desktop on Windows.

### Dokploy (hosted panel)

To run the relay on **[Dokploy](https://docs.dokploy.com/docs/core/docker-compose)**, use **`deploy/dokploy/docker-compose.yml`** as the compose path and follow **`deploy/dokploy/README.md`**.

Streamers connect with **`STT_WS_URL`** or derive **`ws://` / `wss://`** from **`STT_RELAY_URL`** + path `/ws/stt`.

## OBS

OBS → Tools → WebSocket Server Settings. Match **`OBS_WS_HOST`**, **`OBS_WS_PORT`**, **`OBS_WS_PASSWORD`** in `.env`. If OBS is off or unreachable, the JSON agent keeps transcription **on** (same as before).
