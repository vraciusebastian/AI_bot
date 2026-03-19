const { Router }    = require('express');
const { execFileSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const router = Router();
const sleep = ms => new Promise(r => setTimeout(r, ms));

function xdotoolAvailable() {
  if (process.platform === 'win32') return false;
  try { execFileSync('which', ['xdotool'], { stdio: 'pipe' }); return true; }
  catch { return false; }
}

function run(cmd, args, timeout = 10000) {
  try {
    const stdout = execFileSync(cmd, args, { timeout, encoding: 'utf-8', stdio: 'pipe' });
    return { ok: true, stdout: stdout.trim(), stderr: '', returncode: 0 };
  } catch (e) {
    return { ok: false, stdout: '', stderr: (e.stderr || e.message || '').toString().trim(), returncode: e.status || -1 };
  }
}

router.get('/status', (_req, res) => {
  res.json({
    xdotool_available: xdotoolAvailable(),
    platform: process.platform,
    note: 'xdotool only works on Linux/Ubuntu with X11. Install with: sudo apt install xdotool',
  });
});

router.post('/type', async (req, res) => {
  const { text = '', press_enter = false, delay_ms = 0 } = req.body;
  if (!text && !press_enter) return res.status(400).json({ detail: 'text or press_enter required' });
  if (!xdotoolAvailable()) return res.status(503).json({ detail: 'xdotool not installed. Run: sudo apt install xdotool' });

  if (delay_ms > 0) await sleep(delay_ms);

  const steps = [];
  if (text) {
    const r = run('xdotool', ['type', '--clearmodifiers', '--delay', '20', '--', text]);
    steps.push(r);
    if (!r.ok) return res.status(500).json({ detail: `xdotool type failed: ${r.stderr}` });
  }
  if (press_enter) {
    await sleep(50);
    const r = run('xdotool', ['key', 'Return']);
    steps.push(r);
    if (!r.ok) return res.status(500).json({ detail: `xdotool key Return failed: ${r.stderr}` });
  }
  res.json({ ok: true, steps });
});

router.post('/key', (req, res) => {
  const { key = '' } = req.body;
  if (!key) return res.status(400).json({ detail: 'key required' });
  if (!xdotoolAvailable()) return res.status(503).json({ detail: 'xdotool not installed. Run: sudo apt install xdotool' });
  const r = run('xdotool', ['key', key]);
  if (!r.ok) return res.status(500).json({ detail: `xdotool key failed: ${r.stderr}` });
  res.json({ ok: true });
});

router.post('/tar', (req, res) => {
  let { source_path = '', output_path = '' } = req.body;
  source_path = source_path.trim();
  output_path = output_path.trim();
  if (!source_path || !output_path)
    return res.status(400).json({ detail: 'source_path and output_path required' });
  if (!fs.existsSync(source_path))
    return res.status(404).json({ detail: `Source path not found: ${source_path}` });

  source_path = path.resolve(source_path);
  output_path = path.resolve(output_path);
  fs.mkdirSync(path.dirname(output_path), { recursive: true });

  const r = run('tar', ['cf', output_path, '-C', path.dirname(source_path), path.basename(source_path)], 120000);
  if (!r.ok) return res.status(500).json({ detail: `tar failed: ${r.stderr}` });

  const size = fs.existsSync(output_path) ? fs.statSync(output_path).size : 0;
  res.json({ ok: true, output_path, size_bytes: size, size_mb: +(size / 1024 / 1024).toFixed(2) });
});

module.exports = router;
