#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
# A restored Codespace may already have the app running. Do not stop other processes.
if python3 - <<'PY'
import sys, urllib.request
try:
    response = urllib.request.urlopen('http://127.0.0.1:5173/', timeout=3)
    sys.exit(0 if b'Horizon Foundry' in response.read(4096) else 1)
except Exception:
    sys.exit(1)
PY
then
  exit 0
fi
nohup npm run dev -- --host 0.0.0.0 --port 5173 --strictPort > /tmp/horizon-foundry-dev.log 2>&1 < /dev/null &
