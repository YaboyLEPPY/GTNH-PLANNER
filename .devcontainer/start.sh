#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
is_ready() {
  python3 - <<'PY'
import sys, urllib.request
try:
    response = urllib.request.urlopen('http://127.0.0.1:5173/', timeout=1)
    sys.exit(0 if b'Horizon Foundry' in response.read(4096) else 1)
except Exception:
    sys.exit(1)
PY
}
# A restored Codespace may already have the app running. Do not stop other processes.
if is_ready; then
  exit 0
fi
if [[ ! -d node_modules/vite ]]; then
  echo 'Dependencies are missing. Run bash .devcontainer/setup.sh first.' >&2
  exit 1
fi
nohup npm run dev -- --host 0.0.0.0 --port 5173 --strictPort > /tmp/horizon-foundry-dev.log 2>&1 < /dev/null &
planner_launcher_pid=$!
for attempt in {1..30}; do
  if is_ready; then
    echo 'GTNH Planner is ready. Open port 5173 in the Codespaces Ports tab.'
    exit 0
  fi
  if ! kill -0 "$planner_launcher_pid" 2>/dev/null; then
    cat /tmp/horizon-foundry-dev.log >&2
    exit 1
  fi
  sleep 1
done
echo 'Planner did not become ready. Server output:' >&2
cat /tmp/horizon-foundry-dev.log >&2
exit 1
