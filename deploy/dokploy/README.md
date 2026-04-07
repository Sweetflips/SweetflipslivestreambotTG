# Deploy STT relay on Dokploy

[Dokploy](https://docs.dokploy.com/docs/core/docker-compose) runs this repo as a **Docker Compose** app (use **Compose**, not **Stack**, so `build:` works from Git).

## 1. Create the project

1. In Dokploy: **Projects → Docker Compose → Create**.
2. **Source**: connect **GitHub / GitLab / …** to this repository (same branch you use in production).
3. **Compose file**: set path to  
   `deploy/dokploy/docker-compose.yml`
4. **Build**: Dokploy clones the repo and builds from repo root via `context: ../..` in that file.

## 2. Environment variables

In the compose app **Environment** tab, set at least:

| Variable | Notes |
|----------|--------|
| `STT_WS_TOKEN` | **Required for production** — shared secret with streamer PCs (same value everywhere). |
| `STT_ALLOW_OPEN_WS` | `0` in production (default). |
| `STT_LOG_LEVEL` | Optional, e.g. `INFO`. |

Dokploy writes these to `.env` next to the compose file. Do not commit real secrets.

## 3. Domain and HTTPS

1. Open the **Domains** tab for this compose service.
2. **Add domain** pointing at your host (e.g. `stt.example.com`).
3. Enable **HTTPS** (Let’s Encrypt / your provider) per [Dokploy Domains](https://docs.dokploy.com/docs/core/docker-compose/domains).

Dokploy attaches **Traefik** to the `relay` service on port **8000** (see `expose` in the compose file).

## 4. Streamers / clients

Point clients at your public URL:

- **HTTPS / WSS**: `STT_WS_URL=wss://stt.example.com/ws/stt?token=YOUR_TOKEN&role=streamer` (and same `STT_WS_TOKEN` in env), or set `STT_RELAY_URL` / `STT_PUBLIC_HOST` per your agent docs.

## 5. Notes

- **Stack mode** in Dokploy does **not** support `build:`; use **Docker Compose** mode for this file, or push a pre-built image and switch to `image:`.
- **`dokploy-network`** must exist on the Dokploy host (Dokploy creates it). If your install uses another name, adjust `docker-compose.yml` accordingly.
- Relay state is **in-memory**; multiple replicas need sticky sessions or a single replica for WebSockets unless you change architecture.
