#!/usr/bin/env bash
# One-time setup for Behavioral AI Bot on Ubuntu
set -e

echo "=== Behavioral AI Bot — Ubuntu Setup ==="

# ── 1. System packages ────────────────────────────────────────────────────────
echo ""
echo "--- Installing system packages ---"
sudo apt-get update -qq
sudo apt-get install -y \
  docker.io \
  docker-compose-plugin \
  xdotool \
  python3 \
  python3-pip \
  python3-venv \
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

# Add user to docker group (log out and back in after setup for this to take effect)
sudo usermod -aG docker "$USER" || true

# ── 2. Node.js ────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo ""
  echo "--- Installing Node.js 20 ---"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "Node: $(node -v)   npm: $(npm -v)"

# ── 3. Python virtual environment for the backend ────────────────────────────
echo ""
echo "--- Setting up Python backend ---"
BACKEND_DIR="$(dirname "$0")/backend"
python3 -m venv "$BACKEND_DIR/.venv"
"$BACKEND_DIR/.venv/bin/pip" install --quiet --upgrade pip
"$BACKEND_DIR/.venv/bin/pip" install -r "$BACKEND_DIR/requirements.txt"
echo "Backend dependencies installed."

# ── 4. Frontend Node modules ──────────────────────────────────────────────────
echo ""
echo "--- Installing frontend dependencies ---"
npm --prefix "$(dirname "$0")/frontend" install

# ── 5. Root (Electron) Node modules ──────────────────────────────────────────
echo ""
echo "--- Installing Electron dependencies ---"
npm install --prefix "$(dirname "$0")"

# ── 6. Start MongoDB ──────────────────────────────────────────────────────────
echo ""
echo "--- Starting MongoDB via Docker ---"
docker compose -f "$(dirname "$0")/docker-compose.yml" up -d mongodb

echo ""
echo "=== Setup complete ==="
echo ""
echo "How to run:"
echo ""
echo "  Option A — Electron app (recommended):"
echo "    cd $(dirname "$0")"
echo "    npx electron ."
echo ""
echo "  Option B — Docker (backend in container, Electron loads localhost:3000):"
echo "    docker compose up -d          # starts MongoDB + backend"
echo "    cd frontend && npm run dev    # starts Next.js"
echo "    npx electron .                # opens the window"
echo ""
echo "  Option C — Browser only (no Electron):"
echo "    ./run.sh                      # starts backend + frontend"
echo "    Open http://localhost:3000 in your browser"
echo ""
echo "NOTE: xdotool auto-typing requires X11 (not Wayland)."
echo "      If on Wayland, run: export GDK_BACKEND=x11"
echo "      or log in selecting 'Ubuntu on Xorg' at the login screen."
