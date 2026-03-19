#!/usr/bin/env bash
# One-time setup for Behavioral AI Bot on Ubuntu (Electron frontend only).
# The Node.js backend and MongoDB run on the Windows machine.
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== Behavioral AI Bot — Ubuntu Setup ==="

# ── 1. System packages ────────────────────────────────────────────────────────
echo ""
echo "--- Installing system packages ---"
sudo apt-get update -qq
sudo apt-get install -y \
  xdotool \
  curl \
  tar \
  libgtk-3-0 \
  libnotify4 \
  libnss3 \
  libxss1 \
  libxtst6 \
  xdg-utils \
  libatspi2.0-0 \
  libdrm2 \
  libgbm1 \
  libasound2

# ── 2. Node.js ────────────────────────────────────────────────────────────────
echo ""
if ! command -v node &>/dev/null || [[ "$(node -e 'process.stdout.write(process.versions.node.split(".")[0])')" -lt 20 ]]; then
  echo "--- Installing Node.js 20 ---"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "Node: $(node -v)   npm: $(npm -v)"

# ── 3. Frontend dependencies + build ─────────────────────────────────────────
echo ""
echo "--- Installing and building frontend ---"
npm --prefix "$ROOT/frontend" install
npm --prefix "$ROOT/frontend" run build

# ── 4. Electron (root) dependencies ──────────────────────────────────────────
echo ""
echo "--- Installing Electron dependencies ---"
npm install --prefix "$ROOT"

echo ""
echo "=== Setup complete ==="
echo ""
echo "Run the Electron app:"
echo "  cd $ROOT && ./run.sh"
echo ""
echo "On first launch, enter the Windows server URL when prompted,"
echo "e.g. http://192.168.1.105:8000"
echo ""
echo "NOTE: xdotool requires X11. If on Wayland, run: GDK_BACKEND=x11 npx electron ."
