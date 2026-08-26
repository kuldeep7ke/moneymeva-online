#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if ! command -v node &>/dev/null; then
  echo "[FIX NEEDED] Node.js is not installed or not in PATH."
  echo "Install it from https://nodejs.org and run this file again."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[AUTO-FIX] Dependencies missing - installing..."
  npm install
fi

# Kill anything on port 3000
if command -v lsof &>/dev/null; then
  PID=$(lsof -ti:3000 2>/dev/null || true)
  [ -n "$PID" ] && kill -9 $PID 2>/dev/null || true
elif command -v fuser &>/dev/null; then
  fuser -k 3000/tcp 2>/dev/null || true
fi

NEEDBUILD=0
if [ ! -f out/index.html ]; then
  NEEDBUILD=1
elif command -v node &>/dev/null; then
  FRESHNESS=$(node scripts/fresh-check.cjs 2>/dev/null || echo "STALE")
  [ "$FRESHNESS" != "FRESH" ] && NEEDBUILD=1
fi

if [ "$NEEDBUILD" -eq 1 ]; then
  echo "[AUTO-FIX] Building production bundle (first run or source changed)..."
  npx next build
fi

echo "Starting Money Meva on http://localhost:3000 ..."
nohup node scripts/serve.cjs --port 3000 > .server.log 2>&1 &
echo $! > .server.pid

# Wait for server and open browser
for i in $(seq 1 40); do
  if curl -sf http://localhost:3000 > /dev/null 2>&1; then
    # Open in default browser (cross-platform)
    if command -v xdg-open &>/dev/null; then
      xdg-open http://localhost:3000
    elif command -v open &>/dev/null; then
      open http://localhost:3000
    fi
    break
  fi
  sleep 0.5
done

echo ""
echo "  ================================================"
echo "   Money Meva is running:  http://localhost:3000"
echo "   Stop it with:           ./stop-server.sh"
echo "  ================================================"
echo ""
