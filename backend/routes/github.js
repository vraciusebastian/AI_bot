const { Router }   = require('express');
const { ObjectId } = require('mongodb');
const { getDb }    = require('../db');

const router = Router();

function parseGithubUrl(url) {
  url = url.trim().replace(/\/$/, '');
  let m;
  m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/commit\/([a-f0-9]+)/);
  if (m) return { owner: m[1], repo: m[2], type: 'commit', ref: m[3] };
  m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (m) return { owner: m[1], repo: m[2], type: 'pull', ref: m[3] };
  m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
  if (m) return { owner: m[1], repo: m[2], type: 'issue', ref: m[3] };
  m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (m) return { owner: m[1], repo: m[2], type: 'repo', ref: null };
  throw new Error(`Could not parse GitHub URL: ${url}`);
}

async function githubGet(path, token) {
  const headers = { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'BehavioralAIBot' };
  if (token) headers['Authorization'] = `token ${token}`;
  const resp = await fetch(`https://api.github.com${path}`, { headers });
  if (!resp.ok) {
    const text = await resp.text();
    const err = new Error(`GitHub API error: ${text.slice(0, 200)}`);
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}

function mapFiles(files) {
  return files.map(f => ({
    filename:  f.filename,
    status:    f.status || 'modified',
    additions: f.additions || 0,
    deletions: f.deletions || 0,
    patch:     (f.patch || '').slice(0, 500),
  }));
}

router.post('/fetch', async (req, res) => {
  const { url, github_token } = req.body;
  if (!url) return res.status(400).json({ detail: 'url required' });

  let parsed;
  try { parsed = parseGithubUrl(url); }
  catch (e) { return res.status(400).json({ detail: e.message }); }

  const { owner, repo, type, ref } = parsed;
  const base = `/repos/${owner}/${repo}`;
  let title = '', body = '', sha = null, number = null, files = [];
  let head_branch = null, base_branch = null;

  try {
    if (type === 'commit') {
      const data = await githubGet(`${base}/commits/${ref}`, github_token);
      title = (data.commit?.message || '').split('\n')[0];
      body  = data.commit?.message || '';
      sha   = data.sha || ref;
      files = mapFiles(data.files || []);
    } else if (type === 'pull') {
      const pr = await githubGet(`${base}/pulls/${ref}`, github_token);
      title       = pr.title || '';
      body        = pr.body  || '';
      number      = pr.number;
      head_branch = pr.head?.ref;
      base_branch = pr.base?.ref;
      files = mapFiles(await githubGet(`${base}/pulls/${ref}/files`, github_token));
    } else if (type === 'issue') {
      const issue = await githubGet(`${base}/issues/${ref}`, github_token);
      title  = issue.title || '';
      body   = issue.body  || '';
      number = issue.number;
    } else {
      const repoData = await githubGet(base, github_token);
      title = repoData.full_name || `${owner}/${repo}`;
      body  = repoData.description || '';
    }
  } catch (e) {
    return res.status(e.status || 500).json({ detail: e.message });
  }

  const doc = {
    url, repo: `${owner}/${repo}`, url_type: type,
    title, body: (body || '').slice(0, 2000),
    sha, number, head_branch, base_branch,
    files, fetched_at: new Date().toISOString(),
  };

  const result = await getDb().collection('github_data').insertOne(doc);
  res.json({ id: result.insertedId.toString(), ...doc });
});

router.get('/:id', async (req, res) => {
  const doc = await getDb().collection('github_data').findOne({ _id: new ObjectId(req.params.id) });
  if (!doc) return res.status(404).json({ detail: 'GitHub data not found' });
  doc.id = doc._id.toString();
  delete doc._id;
  res.json(doc);
});

module.exports = router;
