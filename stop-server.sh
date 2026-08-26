#!/usr/bin/env bash
cd "$(dirname "$0")"

STOPPED=0

# Try PID file first
if [ -f .server.pid ]; then
  PID=$(cat .server.pid 2>/dev/null || true)
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    echo "Stopped server process $PID"
    STOPPED=1
  fi
  rm -f .server.pid
fi

# Fallback: kill anything on port 3000
if [ "$STOPPED" -eq 0 ]; then
  if command -v lsof &>/dev/null; then
    PID=$(lsof -ti:3000 2>/dev/null || true)
    if [ -n "$PID" ]; then
      kill -9 $PID 2>/dev/null || true
      echo "Killed process(es) on port 3000: $PID"
      STOPPED=1
    fi
  elif command -v fuser &>/dev/null; then
    fuser -k 3000/tcp 2>/dev/null && STOPPED=1 || true
  fi
fi

if [ "$STOPPED" -eq 0 ]; then
  echo "No Money Meva server is currently running on port 3000."
fi

echo "Done."
