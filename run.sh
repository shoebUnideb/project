#!/usr/bin/env bash
# Starts all GILE services using daphne (ASGI) instead of runserver.
set -e

BASE="$(cd "$(dirname "$0")" && pwd)"
VENV="$BASE/venv/bin"
LOGS="$BASE/.logs"
PIDS="$BASE/.pids"

mkdir -p "$LOGS" "$PIDS"

stop_existing() {
  for port in 8001 8002 8003; do
    pid=$(lsof -ti TCP:$port 2>/dev/null) && kill $pid 2>/dev/null && echo "  Stopped process on :$port" || true
  done
  # Stop old frontend devservers if tracked
  for f in "$PIDS"/fe_*.pid; do
    [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null || true
  done
}

start_backend() {
  local name=$1 dir=$2 port=$3 module=$4
  cd "$dir"
  "$VENV/daphne" \
    -b 127.0.0.1 \
    -p "$port" \
    --access-log "$LOGS/${name}.access.log" \
    -v 1 \
    "${module}.asgi:application" \
    > "$LOGS/${name}.log" 2>&1 &
  echo $! > "$PIDS/${name}.pid"
  echo "  [$name] daphne started on :$port  (log: .logs/${name}.log)"
}

start_frontend() {
  local name=$1 dir=$2
  cd "$dir"
  npm run dev > "$LOGS/${name}.log" 2>&1 &
  echo $! > "$PIDS/fe_${name}.pid"
  echo "  [$name] vite started  (log: .logs/${name}.log)"
}

echo ""
echo "Stopping existing services..."
stop_existing

echo ""
echo "Starting backends..."
start_backend auth     "$BASE/auth/backend"     8001 auth_service
start_backend public   "$BASE/public/backend"   8002 public_platform
start_backend internal "$BASE/internal/backend" 8003 internal_platform

echo ""
echo "Starting frontends..."
start_frontend public-fe   "$BASE/public/frontend"
start_frontend internal-fe "$BASE/internal/frontend"

echo ""
echo "Waiting for backends to be ready..."
sleep 4

all_ok=true
for port in 8001 8002 8003; do
  if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$port/health/" | grep -qE "^[23]"; then
    echo "  :$port OK"
  else
    echo "  :$port not responding yet — check .logs/"
    all_ok=false
  fi
done

echo ""
if $all_ok; then
  echo "All services running."
else
  echo "Some services may still be starting. Run: tail -f .logs/*.log"
fi

echo ""
echo "URLs:"
echo "  Auth backend   http://127.0.0.1:8001"
echo "  Auth admin     http://127.0.0.1:8001/admin/"
echo "  Public backend http://127.0.0.1:8002"
echo "  Public admin   http://127.0.0.1:8002/admin/"
echo "  Internal backend http://127.0.0.1:8003"
echo "  Internal admin   http://127.0.0.1:8003/admin/"
echo "  Public frontend  http://localhost:5173"
echo "  Internal frontend http://localhost:5174"
echo ""
