# Behavioral AI Bot

A desktop app that automates the Revelo behavioral data annotation workflow.

**Architecture:**
- **Windows machine** — runs the Python backend (API) and MongoDB database
- **Ubuntu machine** — runs the Electron desktop app (UI)

The Ubuntu app connects to the Windows server over your local network (or localhost if both are on the same machine).

---

## Table of Contents

1. [Requirements](#requirements)
2. [Windows Server Setup](#windows-server-setup)
3. [Ubuntu Client Setup](#ubuntu-client-setup)
4. [Building the Ubuntu App (.AppImage)](#building-the-ubuntu-appimage)
5. [Running the App — Step by Step](#running-the-app--step-by-step)
6. [Workflow Guide](#workflow-guide)
7. [xdotool Terminal Automation](#xdotool-terminal-automation)
8. [Creating the Tar File](#creating-the-tar-file)
9. [Troubleshooting](#troubleshooting)

---

## Requirements

### Windows machine
| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.10+ | [python.org](https://www.python.org/downloads/) |
| Docker Desktop | latest | [docker.com](https://www.docker.com/products/docker-desktop/) |
| Node.js | 20+ | Only needed to build the frontend once |

### Ubuntu machine
| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ | For building the AppImage |
| xdotool | any | `sudo apt install xdotool` — enables auto-typing |
| X11 display | — | Required for xdotool (see [Wayland note](#xdotool-on-wayland)) |

---

## Windows Server Setup

Do this **once** on the Windows machine.

### Step 1 — Clone the project

```cmd
git clone <your-repo-url>
cd "behavioral work"
```

### Step 2 — Run the setup script

Double-click **`setup-server.bat`** or run in Command Prompt:

```cmd
setup-server.bat
```

This will:
- Create a Python virtual environment in `backend/.venv/`
- Install all Python dependencies
- Pull the MongoDB Docker image

### Step 3 — Allow port 8000 through Windows Firewall

Open **PowerShell as Administrator**:

```powershell
New-NetFirewallRule -DisplayName "Behavioral AI Bot API" `
  -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
```

### Step 4 — Start the server

Every time you want to use the app, run **`start-server.bat`** (or the PowerShell version):

```cmd
start-server.bat
```

Or with PowerShell for more info (shows your IP addresses):

```powershell
powershell -ExecutionPolicy Bypass -File start-server.ps1
```

The script will print your machine's IP addresses, for example:
```
  http://192.168.1.105:8000
  http://172.20.10.3:8000
```

Keep this terminal open while using the app.

---

## Ubuntu Client Setup

### Step 1 — Install system packages

```bash
sudo apt update
sudo apt install -y nodejs npm xdotool
```

> **Node.js 20+** — if your distro ships an older version:
> ```bash
> curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
> sudo apt install -y nodejs
> ```

### Step 2 — Clone the project (same repo)

```bash
git clone <your-repo-url>
cd "behavioral work"
```

### Step 3 — Build the frontend

This creates the static files that the Electron app will serve.

```bash
cd frontend
npm install
npm run build
cd ..
```

After this, `frontend/out/` should exist and contain `index.html`.

### Step 4 — Install Electron dependencies

```bash
npm install
```

---

## Building the Ubuntu App (.AppImage)

To create a standalone `.AppImage` file you can run on any Ubuntu machine without Node.js:

```bash
# Make sure you've already run: cd frontend && npm run build
npm run dist:appimage
```

Output: `dist/Behavioral AI Bot-1.0.0.AppImage`

Make it executable and run it:

```bash
chmod +x "dist/Behavioral AI Bot-1.0.0.AppImage"
./"dist/Behavioral AI Bot-1.0.0.AppImage"
```

> **To run without installing:** AppImage files are self-contained — copy the `.AppImage` to any Ubuntu machine and double-click it.

---

## Running the App — Step by Step

### 1. Start the Windows server

Run `start-server.bat` on the Windows machine. Note the IP address printed (e.g., `http://192.168.1.105:8000`).

### 2. Launch the Ubuntu app

**Dev mode** (from the project folder):
```bash
npx electron .
```

**Or run the AppImage:**
```bash
./"dist/Behavioral AI Bot-1.0.0.AppImage"
```

### 3. First-time configuration

On first launch, a setup window appears asking for the server URL.

Enter the URL printed by `start-server.bat`, for example:
```
http://192.168.1.105:8000
```

Click **Save & Launch**. This is saved and won't be asked again.

> To change the server URL later, close the app, delete `~/.config/behavioral-ai-bot/config.json`, and relaunch.

---

## Workflow Guide

The app follows the Revelo behavioral annotation workflow. Here is the full step-by-step guide.

### Step 1 — Upload Requirements Document

1. Open the app (you will land on the **Upload** page)
2. Drag and drop the task requirement document (`.txt`, `.md`, `.pdf`, or any text file)
3. Click **Use This & Continue**

The document is stored in MongoDB and used to make prompts more accurate.

### Step 2 — Enter GitHub URL

1. Paste the GitHub URL for the issue/commit you are working on
   - Any format works: commit URL, PR URL, issue URL, or plain repo URL
   - Example: `https://github.com/iam4x/isomorphic-flux-boilerplate/commit/9fddd2d4ae201e6ddbdedbe6891fd37ed2af1cfe`
2. (Optional) Enter a GitHub personal token to avoid rate limits
3. Click **Fetch GitHub Data**
4. When the data loads, click **Generate Prompts →**

### Step 3 — Get the 10 Prompts Plan

1. The app shows a prompt to copy into claude.ai
2. Copy it → paste into [claude.ai](https://claude.ai) → send
3. Copy Claude's response (which contains a JSON array) → paste back into the app
4. Click **Parse & Load Prompts**
5. Review the 10 prompts and click **Start Interactions →**

### Step 4 — Run Interactions (repeat 10 times)

For each interaction:

#### 4a. Copy the prompt
- The suggested prompt is shown in the **Prompt** box (editable)
- Copy it and paste it into your `claude-hfi` terminal

#### 4b. Wait for Model A and B to respond

The results are saved to `1.txt` in each cloned VSCode repo.

**Use the File Watcher** (recommended — auto-fills the text areas):
1. Enter the path to each repo folder in the **Auto-read 1.txt** panel
   - Example: `/home/user/repos/project-a`
   - The app will look for `1.txt` inside that folder
2. Click **Watch for 1.txt**
3. The app polls every 2 seconds. When both files are written, they are automatically loaded into Model A and B text areas

**Or paste manually:**
- Copy the content of each `1.txt` file and paste into the Model A / Model B text areas

#### 4c. Generate feedback
1. Click **Generate Feedback**
2. Copy the evaluation prompt that appears
3. Paste it into [claude.ai](https://claude.ai) → send
4. Copy Claude's JSON response → paste back into the app
5. Click **Parse Feedback**

The app displays:
- **Preferred model** (A or B) with justification
- **Model A Pros / Cons**
- **Model B Pros / Cons**
- **7 axis evaluations** with scores

#### 4d. Enter answers in the terminal

Use the **Terminal Automation** panel (requires xdotool):

1. Click inside your `claude-hfi` terminal window to focus it
2. For each field the terminal asks, click the matching **Type↵** button in the app
3. The text is automatically typed + Enter pressed

Or use **Copy** buttons to copy each value manually.

**Quick model selection** — click `A`, `B`, `a`, `b`, `AA`, or `BB` to auto-type your preference.

#### 4e. Continue
- Click **Next Interaction →** in the app
- Click **continue** in the `claude-hfi` terminal
- Repeat for all 10 interactions

### Step 5 — Finish

After interaction 10:
1. Click **Finish All Interactions**
2. The **Done** page shows a summary of all 10 feedbacks
3. Click **Copy All Feedback** to copy the full export

### Step 6 — Create the Tar File

On the **Done** page:
1. Enter the **source repo directory** (the cloned repo you worked on)
2. Enter the **output `.tar` path** (e.g., `/home/user/final_state.tar`)
3. Click **Create tar**

This runs `tar cf output.tar /path/to/repo` — the same command required by Revelo.

### Step 7 — Submit on Revelo

Fill in the Revelo platform forms with:
- The final comments (from the **Done** page)
- The transcript-level ratings
- Upload the `.tar` file

---

## xdotool Terminal Automation

xdotool types text into whichever window is currently focused. To use it:

1. **Install:** `sudo apt install xdotool`
2. Click inside the `claude-hfi` terminal to focus it
3. Click a **Type↵** button in the app — the text is typed and Enter is pressed

> The app window must **not** be in focus when xdotool types. Click the terminal, then immediately click the button in the app (the button press refocuses the terminal within ~50ms — this is handled automatically).

### xdotool on Wayland

xdotool requires **X11**. If you are on Wayland (default in Ubuntu 22.04+):

**Option A** — Log out and select "Ubuntu on Xorg" at the login screen.

**Option B** — Run the app with X11 backend:
```bash
GDK_BACKEND=x11 npx electron .
```

**Option C** — Check your session type:
```bash
echo $XDG_SESSION_TYPE   # should print "x11", not "wayland"
```

---

## Creating the Tar File

The Revelo guidelines require:
```bash
tar cf final_state.tar name_of_directory_to_tar
```

The app's **Done** page runs this automatically. Just provide:
- **Source path:** the repo folder (e.g., `/home/user/repos/isomorphic-flux-boilerplate`)
- **Output path:** where to save the tar (e.g., `/home/user/Desktop/final_state.tar`)

---

## Troubleshooting

### App shows "Build not found"
The frontend static build is missing. Run:
```bash
cd frontend && npm run build
```

### "Cannot connect to server" / API errors
- Make sure `start-server.bat` is running on the Windows machine
- Check the URL you entered (must include `http://` and port `:8000`)
- Make sure port 8000 is allowed through the Windows Firewall
- Both machines must be on the same network

### xdotool types in the wrong window
- Click the terminal window first, then quickly click the **Type↵** button
- The button uses a short delay before typing so focus can switch back

### xdotool not available
```bash
sudo apt install xdotool
```
If it still shows unavailable, restart the app after installing.

### File watcher not detecting 1.txt
- Make sure you enter the **folder path** (not the file path) — or the full path including `/1.txt`
- The watcher detects writes **newer than** when you clicked "Watch". If the file already existed before you clicked Watch, manually click **Watch** again after the models finish responding.

### MongoDB not connecting
On Windows, make sure Docker Desktop is running, then:
```cmd
docker compose up -d mongodb
```

### Python backend not starting
Make sure `setup-server.bat` was run first to create the venv. Then check:
```cmd
backend\.venv\Scripts\python.exe --version
```

---

## Project Structure

```
behavioral work/
├── backend/                  # Python FastAPI server (runs on Windows)
│   ├── app.py                # FastAPI app entry point
│   ├── database.py           # MongoDB connection
│   ├── models.py             # Pydantic models
│   ├── requirements.txt      # Python dependencies
│   ├── Dockerfile            # Optional Docker build
│   └── routes/
│       ├── documents.py      # Upload & store requirement docs
│       ├── github.py         # Fetch GitHub URL data
│       ├── prompts.py        # Generate 10 interaction prompts
│       ├── feedback.py       # Generate feedback for each interaction
│       ├── watcher.py        # Poll filesystem for 1.txt files
│       └── automation.py     # xdotool + tar file creation
├── electron/                 # Electron app (runs on Ubuntu)
│   ├── main.js               # Main process — static server + config
│   ├── preload.js            # Injects Windows server URL into renderer
│   ├── config-preload.js     # Preload for the setup window
│   └── setup.html            # First-time server URL configuration UI
├── frontend/                 # Next.js app (built to frontend/out/)
│   ├── pages/
│   │   ├── index.js          # Upload requirements
│   │   ├── github.js         # GitHub URL input
│   │   ├── plan.js           # View & parse 10 prompts
│   │   ├── interaction.js    # Run interactions + file watcher + automation
│   │   └── done.js           # Summary + tar file creation
│   ├── components/
│   │   ├── api.js            # HTTP client (uses Windows server URL)
│   │   └── Layout.js         # Navigation layout
│   ├── styles/globals.css    # Global dark theme styles
│   └── next.config.js        # Static export config
├── docker-compose.yml        # MongoDB (run on Windows)
├── setup-server.bat          # Windows: one-time backend setup
├── start-server.bat          # Windows: start MongoDB + backend
├── start-server.ps1          # Windows: PowerShell version (shows IP)
├── setup.sh                  # Ubuntu: one-time system setup
├── run.sh                    # Ubuntu: browser-only mode (no Electron)
└── README.md                 # This file
```
