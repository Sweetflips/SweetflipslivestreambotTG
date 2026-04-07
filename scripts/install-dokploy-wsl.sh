#!/usr/bin/env bash
# Run inside WSL Ubuntu after: PC reboot, Ubuntu first-launch (user/password), Docker Desktop running with WSL integration enabled for Ubuntu.
set -euo pipefail
if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found in PATH. Start Docker Desktop and enable Settings > Resources > WSL integration for this distro." >&2
  exit 1
fi
curl -sSL https://dokploy.com/install.sh | sh
