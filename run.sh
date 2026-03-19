#!/usr/bin/env bash
# Start backend + frontend (browser mode — no Electron window needed)
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
VENV="$ROOT/backend/.venv/bin/activate"

if [ ! -f "$VENV" ]; then
  echo "Python venv not found. Run ./setup.sh first."
  exit 1
fi

# Ensure MongoDB is running
docker compose -f "$ROOT/docker-compose.yml" up -d mongodb

trap 'echo "Stopping..."; kill 0' INT TERM

echo "Starting backend on :8000 ..."
(
  source "$VENV"
  cd "$ROOT/backend"
  python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
) &

echo "Starting frontend on :3000 ..."
(
  cd "$ROOT/frontend"
  npm run dev
) &

echo ""
echo "Open http://localhost:3000 in your browser."
echo "Press Ctrl+C to stop."

wait
