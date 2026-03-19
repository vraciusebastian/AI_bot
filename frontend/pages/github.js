import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { apiFetch } from '../components/api';

export default function GitHubPage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ghData, setGhData] = useState(null);

  async function handleFetch() {
    if (!url.trim()) return setError('Enter a GitHub URL.');
    if (!url.includes('github.com')) return setError('Must be a GitHub link.');

    setLoading(true);
    setError('');
    setGhData(null);

    try {
      const data = await apiFetch('/api/github/fetch', {
        method: 'POST',
        body: JSON.stringify({ url: url.trim(), github_token: token.trim() || null }),
      });
      setGhData(data);

      // Store for next step
      localStorage.setItem('github_data_id', data.id);
      localStorage.setItem('github_data', JSON.stringify(data));
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function handleContinue() {
    // Generate prompts (creates session + returns prompt text)
    setLoading(true);
    setError('');

    const docId = localStorage.getItem('selected_doc_id') || null;

    try {
      const result = await apiFetch('/api/prompts/generate', {
        method: 'POST',
        body: JSON.stringify({
          github_data_id: ghData.id,
          document_id: docId,
        }),
      });

      localStorage.setItem('session_id', result.session_id);
      localStorage.setItem('prompt_text', result.prompt_text);

      router.push('/plan');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <Layout step={2}>
      <div className="center-content">
        <h2 style={{ marginBottom: 8 }}>GitHub URL</h2>
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 24 }}>
          Paste any GitHub link — commit, PR, issue, or repo. The app will fetch
          the relevant data and use it to create debugging prompts.
        </p>

        <div className="card">
          <div className="form-group">
            <label>GitHub URL *</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repo/commit/abc123"
            />
          </div>

          <div className="form-group">
            <label>GitHub Token (optional — avoids rate limits)</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_..."
            />
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

          {!ghData && (
            <button
              className="btn btn-primary"
              onClick={handleFetch}
              disabled={loading}
            >
              {loading ? 'Fetching...' : 'Fetch GitHub Data'}
            </button>
          )}

          {loading && !ghData && (
            <div className="loading-row" style={{ marginTop: 12 }}>
              <div className="spinner" />
              <span>Fetching from GitHub API...</span>
            </div>
          )}
        </div>

        {ghData && (
          <div className="card">
            <div className="card-title">Fetched Data</div>

            <div style={{ marginBottom: 10 }}>
              <strong>{ghData.title}</strong>
            </div>

            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>
              <div>Repo: {ghData.repo}</div>
              {ghData.sha && <div>Commit: {ghData.sha}</div>}
              {ghData.number && <div>#{ghData.number}</div>}
              {ghData.head_branch && <div>Branch: {ghData.head_branch} → {ghData.base_branch}</div>}
            </div>

            {ghData.body && (
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12, whiteSpace: 'pre-wrap', maxHeight: 150, overflow: 'auto' }}>
                {ghData.body.slice(0, 500)}
              </div>
            )}

            {ghData.files?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
                  Changed files ({ghData.files.length}):
                </div>
                <div>
                  {ghData.files.slice(0, 15).map((f) => (
                    <span key={f.filename} className="file-tag">
                      {f.filename.split('/').pop()} (+{f.additions}/-{f.deletions})
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="btn-row">
              <button
                className="btn btn-primary"
                onClick={handleContinue}
                disabled={loading}
              >
                {loading ? 'Creating session...' : 'Generate Prompts →'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => { setGhData(null); setUrl(''); }}
              >
                Try Different URL
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
