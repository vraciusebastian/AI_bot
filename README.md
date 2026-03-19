# Behavioral AI Bot

A desktop app that automates the Revelo behavioral data annotation workflow.

**Architecture:**
- **Windows machine** — runs the Node.js backend (API) and MongoDB
- **Ubuntu machine** — runs the Electron desktop app (UI)

The Ubuntu app connects to the Windows server over your local network.

---

## Table of Contents

1. [Requirements](#requirements)
2. [Windows Server Setup](#windows-server-setup)
3. [Ubuntu Client Setup](#ubuntu-client-setup)
4. [Running the App](#running-the-app)
5. [Workflow Guide](#workflow-guide)
6. [Troubleshooting](#troubleshooting)

---

## Requirements

### Windows machine
| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| MongoDB | 7.0 | Installed as a Windows service — [mongodb.com](https://www.mongodb.com/try/download/community) |

### Ubuntu machine
| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ | For running the Electron app |
| xdotool | any | `sudo apt install xdotool` — enables auto-typing |
| X11 display | — | Required for xdotool (see [Wayland note](#xdotool-on-wayland)) |

---

## Windows Server Setup

Do this **once** on the Windows machine.

### Step 1 — Install MongoDB

Download the **MongoDB Community Server 7.0 MSI** from [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community).

Run the installer:
- Choose **Complete** installation
- Check **"Install MongoDB as a Windows Service"**

Verify it is running:
```powershell
Get-Service -Name MongoDB
```

### Step 2 — Clone the project

```cmd
git clone <your-repo-url>
cd behavioral_work
```

### Step 3 — Run the setup script

Double-click **`setup-server.bat`** or run in Command Prompt:

```cmd
setup-server.bat
```

This installs the Node.js backend dependencies (`npm install` in `backend/`).

### Step 4 — Allow port 8000 through Windows Firewall

Open **PowerShell as Administrator** (one-time only):

```powershell
New-NetFirewallRule -DisplayName "Behavioral AI Bot API" `
  -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
```

### Step 5 — Start the server

Every time you want to use the app:

```powershell
powershell -ExecutionPolicy Bypass -File start-server.ps1
```

This starts MongoDB (if not already running) and launches the backend on port 8000. It also prints your machine's IP addresses, for example:
```
  http://192.168.1.105:8000
```

Keep this terminal open while using the app.

---

## Ubuntu Client Setup

Do this **once** on the Ubuntu machine.

### Step 1 — Clone the project

```bash
git clone <your-repo-url>
cd behavioral_work
```

### Step 2 — Run the setup script

```bash
chmod +x setup.sh
./setup.sh
```

This installs Node.js, xdotool, Electron dependencies, and builds the frontend.

---

## Running the App

### 1. Start the Windows server

```powershell
powershell -ExecutionPolicy Bypass -File start-server.ps1
```

Note the IP address printed (e.g. `http://192.168.1.105:8000`).

### 2. Launch the Ubuntu app

```bash
./run.sh
```

### 3. First-time configuration

On first launch, a setup window appears asking for the server URL.

Enter the URL printed by the Windows script:
```
http://192.168.1.105:8000
```

Click **Save & Launch**. This is saved and won't be asked again.

> To reset the server URL, delete `~/.config/behavioral-ai-bot/config.json` and relaunch.

---

## Workflow Guide

### Step 1 — Upload Requirements Document

1. Open the app (you will land on the **Upload** page)
2. Drag and drop the task requirement document (`.txt`, `.md`, `.pdf`, or any text file)
3. Click **Use This & Continue**

### Step 2 — Enter GitHub URL

1. Paste the GitHub URL for the issue/commit you are working on
   - Any format works: commit URL, PR URL, issue URL, or plain repo URL
2. (Optional) Enter a GitHub personal token to avoid rate limits
3. Click **Fetch GitHub Data**
4. When the data loads, click **Generate Prompts →**

### Step 3 — Get the 10 Prompts Plan

1. The app shows a prompt to copy into claude.ai
2. Copy it → paste into [claude.ai](https://claude.ai) → send
3. Copy Claude's response → paste back into the app
4. Click **Parse & Load Prompts**
5. Review the 10 prompts and click **Start Interactions →**

### Step 4 — Run Interactions (repeat 10 times)

#### 4a. Copy the prompt
- The suggested prompt is shown in the **Prompt** box (editable)
- Copy it and paste it into your `claude-hfi` terminal

#### 4b. Wait for Model A and B to respond

Results are saved to `1.txt` in each cloned VSCode repo.

**Use the File Watcher** (auto-fills the text areas):
1. Enter the path to each repo folder in the **Auto-read 1.txt** panel
2. Click **Watch for 1.txt**
3. The app polls every 2 seconds — when both files are written, they are loaded automatically

**Or paste manually:**
- Copy the content of each `1.txt` file and paste into the Model A / Model B text areas

#### 4c. Generate feedback
1. Click **Generate Feedback**
2. Copy the evaluation prompt
3. Paste into [claude.ai](https://claude.ai) → send
4. Copy Claude's JSON response → paste back → click **Parse Feedback**

#### 4d. Enter answers in the terminal

Use the **Terminal Automation** panel (requires xdotool):

1. Click inside the `claude-hfi` terminal to focus it
2. Click the matching **Type↵** button in the app for each field
3. The text is automatically typed and Enter is pressed

Or use **Copy** buttons to copy each value manually.

#### 4e. Continue
- Click **Next Interaction →** in the app
- Click **continue** in the `claude-hfi` terminal
- Repeat for all 10 interactions

### Step 5 — Finish

1. Click **Finish All Interactions**
2. The **Done** page shows a summary of all 10 feedbacks
3. Click **Copy All Feedback**

### Step 6 — Create the Tar File

On the **Done** page:
1. Enter the **source repo directory**
2. Enter the **output `.tar` path**
3. Click **Create tar**

### Step 7 — Submit on Revelo

Fill in the Revelo platform forms with the final comments and ratings, then upload the `.tar` file.

---

## xdotool Terminal Automation

xdotool types text into whichever window is currently focused.

1. Click inside the `claude-hfi` terminal to focus it
2. Click a **Type↵** button in the app — the text is typed and Enter is pressed

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

## Troubleshooting

### App shows "Build not found"
```bash
cd frontend && npm run build
```

### "Cannot connect to server" / API errors
- Make sure `start-server.ps1` is running on the Windows machine
- Check the URL (must include `http://` and port `:8000`)
- Make sure port 8000 is allowed through the Windows Firewall
- Both machines must be on the same network

### MongoDB not starting
Make sure MongoDB was installed as a Windows service, then:
```powershell
Start-Service -Name MongoDB
Get-Service -Name MongoDB
```

### Backend not starting
Make sure `setup-server.bat` was run first, then check Node.js is installed:
```cmd
node --version
```

### xdotool types in the wrong window
Click the terminal window first, then quickly click the **Type↵** button.

### xdotool not available
```bash
sudo apt install xdotool
```

Restart the app after installing.

### File watcher not detecting 1.txt
- Enter the **folder path**, not the file path
- If the file already existed before clicking Watch, click **Watch** again after the models finish

---

## Project Structure

```
behavioral_work/
├── backend/                  # Node.js/Express server (runs on Windows)
│   ├── server.js             # Entry point
│   ├── db.js                 # MongoDB connection
│   ├── package.json          # Backend dependencies
│   └── routes/
│       ├── documents.js      # Upload & store requirement docs
│       ├── github.js         # Fetch GitHub URL data
│       ├── prompts.js        # Generate 10 interaction prompts
│       ├── feedback.js       # Generate feedback for each interaction
│       ├── watcher.js        # Poll filesystem for 1.txt files
│       └── automation.js     # xdotool + tar file creation
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
├── setup-server.bat          # Windows: one-time backend setup (npm install)
├── start-server.bat          # Windows: start MongoDB service + backend
├── start-server.ps1          # Windows: PowerShell version (shows IP)
├── setup.sh                  # Ubuntu: one-time system + Electron setup
├── run.sh                    # Ubuntu: launch the Electron app
└── README.md
```
