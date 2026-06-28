#!/usr/bin/env bash
# Stops all GILE services.

BASE="$(cd "$(dirname "$0")" && pwd)"
PIDS="$BASE/.pids"

echo "Stopping GILE services..."

for f in "$PIDS"/*.pid; do
  [ -f "$f" ] || continue
  pid=$(cat "$f")
  name=$(basename "$f" .pid)
  if kill "$pid" 2>/dev/null; then
    echo "  Stopped $name (pid $pid)"
  else
    echo "  $name was not running"
  fi
  rm -f "$f"
done

# Kill any stragglers on the known ports
for port in 8001 8002 8003; do
  pid=$(lsof -ti TCP:$port 2>/dev/null) && kill $pid 2>/dev/null && echo "  Killed leftover on :$port" || true
done

echo "Done."
