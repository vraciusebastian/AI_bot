const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const STATIC_DIR = path.join(ROOT, 'frontend', 'out');
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
const STATIC_PORT = 4174;

let mainWindow = null;
let staticServer = null;

// ── Config ────────────────────────────────────────────────────────────────────

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(data) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

// ── Minimal static file server ────────────────────────────────────────────────

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
};

function startStaticServer() {
  return new Promise((resolve, reject) => {
    staticServer = http.createServer((req, res) => {
      let urlPath = req.url.split('?')[0];

      // Candidates to try in order
      const candidates = [
        path.join(STATIC_DIR, urlPath),
        path.join(STATIC_DIR, urlPath, 'index.html'),
        path.join(STATIC_DIR, urlPath.replace(/\/$/, ''), 'index.html'),
        path.join(STATIC_DIR, 'index.html'), // fallback for client-side routing
      ];

      let filePath = null;
      for (const c of candidates) {
        try {
          if (fs.statSync(c).isFile()) { filePath = c; break; }
        } catch {}
      }

      if (!filePath) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });

    staticServer.listen(STATIC_PORT, '127.0.0.1', () => resolve());
    staticServer.on('error', reject);
  });
}

// ── Setup window (first-time config) ─────────────────────────────────────────

function showSetupWindow(existingUrl) {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 520,
      height: 340,
      resizable: false,
      frame: true,
      title: 'Behavioral AI Bot — Server Setup',
      backgroundColor: '#0f1117',
      webPreferences: {
        preload: path.join(__dirname, 'config-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    win.setMenuBarVisibility(false);
    win.loadFile(path.join(__dirname, 'setup.html'));

    // Send current value once ready
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('current-url', existingUrl || '');
    });

    ipcMain.once('save-server-url', (_e, url) => {
      const trimmed = url.trim().replace(/\/$/, '');
      saveConfig({ serverUrl: trimmed });
      win.close();
      resolve(trimmed);
    });

    win.on('closed', () => {
      // If closed without saving, resolve with existing or empty
      resolve(existingUrl || null);
    });
  });
}

// ── Main window ───────────────────────────────────────────────────────────────

function createMainWindow(serverUrl) {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 960,
    minHeight: 680,
    title: 'Behavioral AI Bot',
    backgroundColor: '#0f1117',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [`--api-base=${serverUrl}`],
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${STATIC_PORT}`);
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Check if static export exists
  if (!fs.existsSync(path.join(STATIC_DIR, 'index.html'))) {
    dialog.showErrorBox(
      'Build not found',
      `The frontend build is missing.\n\nExpected: ${STATIC_DIR}\n\nRun on the Windows machine:\n  cd frontend && npm run build`
    );
    app.quit();
    return;
  }

  // Always show setup window on startup so user can confirm or change the URL
  const config = readConfig();
  let serverUrl = await showSetupWindow(config.serverUrl || null);
  if (!serverUrl) {
    app.quit();
    return;
  }

  // Start static file server
  try {
    await startStaticServer();
  } catch (err) {
    dialog.showErrorBox('Port conflict', `Could not start on port ${STATIC_PORT}:\n${err.message}`);
    app.quit();
    return;
  }

  createMainWindow(serverUrl);

  // Menu item to change server URL
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow(serverUrl);
  });
});

// Allow changing server URL from renderer
ipcMain.handle('get-server-url', () => readConfig().serverUrl || '');
ipcMain.handle('change-server-url', async () => {
  const config = readConfig();
  const newUrl = await showSetupWindow(config.serverUrl);
  if (newUrl) mainWindow && mainWindow.reload();
  return newUrl;
});
ipcMain.handle('set-server-url', (_e, url) => {
  const trimmed = url.trim().replace(/\/$/, '');
  saveConfig({ serverUrl: trimmed });
  mainWindow && mainWindow.reload();
});

app.on('window-all-closed', () => {
  if (staticServer) staticServer.close();
  if (process.platform !== 'darwin') app.quit();
});
