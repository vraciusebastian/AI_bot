const { Router } = require('express');
const fs   = require('fs');
const path = require('path');

const router = Router();
const sessionPaths = {};

router.post('/configure', (req, res) => {
  const { session_id, path_a = '', path_b = '' } = req.body;
  if (!session_id) return res.status(400).json({ detail: 'session_id required' });
  sessionPaths[session_id] = {
    path_a: path_a.trim(),
    path_b: path_b.trim(),
    configured_at: Date.now() / 1000,
  };
  res.json({ ok: true });
});

router.get('/check', (req, res) => {
  const { session_id, since = '0' } = req.query;
  const paths = sessionPaths[session_id];
  if (!paths)
    return res.status(404).json({ detail: 'No paths configured for this session. Call /configure first.' });

  function probe(rawPath) {
    if (!rawPath) return { ready: false, reason: 'path not set' };
    let p = rawPath;
    try {
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, '1.txt');
      if (!fs.existsSync(p)) return { ready: false, reason: 'file not found', path: p };
      const mtime = fs.statSync(p).mtimeMs / 1000;
      if (parseFloat(since) && mtime < parseFloat(since))
        return { ready: false, reason: 'file not updated yet', path: p, mtime };
      return { ready: true, path: p, mtime, content: fs.readFileSync(p, 'utf-8') };
    } catch (e) {
      return { ready: false, reason: e.message, path: p };
    }
  }

  const file_a = probe(paths.path_a);
  const file_b = probe(paths.path_b);
  res.json({ both_ready: file_a.ready && file_b.ready, file_a, file_b });
});

router.post('/read', (req, res) => {
  let p = (req.body.path || '').trim();
  if (!p) return res.status(400).json({ detail: 'path required' });
  try {
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, '1.txt');
    if (!fs.existsSync(p)) return res.status(404).json({ detail: `File not found: ${p}` });
    const content = fs.readFileSync(p, 'utf-8');
    res.json({ path: p, content, size: content.length });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

module.exports = router;
