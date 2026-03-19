#!/usr/bin/env bash
# Launch the Electron app (Ubuntu frontend).
# The Node.js backend must already be running on the Windows machine.
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "$ROOT/frontend/out/index.html" ]; then
  echo "[ERROR] Frontend build not found. Run ./setup.sh first."
  exit 1
fi

if [ ! -d "$ROOT/node_modules/electron" ]; then
  echo "[ERROR] Electron not installed. Run: npm install"
  exit 1
fi

echo "Launching Behavioral AI Bot..."
echo ""
echo "If this is your first run, a setup window will appear."
echo "Enter the Windows server URL (e.g. http://192.168.1.105:8000) and click Save & Launch."
echo ""

if [ "${XDG_SESSION_TYPE}" = "wayland" ]; then
  echo "Wayland detected — forcing X11 backend for xdotool compatibility."
  export GDK_BACKEND=x11
fi

cd "$ROOT"
npx electron .
