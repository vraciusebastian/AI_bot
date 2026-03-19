import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { apiFetch } from '../components/api';

const AXIS_LABELS = {
  logicCorrectness: 'Logic & Correctness',
  namingClarity: 'Naming & Clarity',
  organizationModularity: 'Organization & Modularity',
  interfaceDesign: 'Interface Design',
  errorHandling: 'Error Handling',
  documentation: 'Documentation',
  productionReadiness: 'Production Readiness',
};

export default function DonePage() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [copied, setCopied] = useState(false);

  // Tar creation state
  const [sourcePath, setSourcePath] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [tarLoading, setTarLoading] = useState(false);
  const [tarResult, setTarResult] = useState(null);
  const [tarError, setTarError] = useState('');

  useEffect(() => {
    const data = localStorage.getItem('all_feedbacks');
    if (data) {
      try { setFeedbacks(JSON.parse(data)); } catch {}
    }
    // Pre-fill paths from watcher config
    const pa = localStorage.getItem('watcher_path_a') || '';
    if (pa) setSourcePath(pa);
  }, []);

  const aWins = feedbacks.filter((f) => f?.preferred === 'A').length;
  const bWins = feedbacks.filter((f) => f?.preferred === 'B').length;
  const total = feedbacks.filter(Boolean).length;

  function buildExportText() {
    return feedbacks.map((fb, i) => {
      if (!fb) return `=== Interaction ${i + 1} ===\n(no feedback)`;
      return [
        `=== Interaction ${i + 1} ===`,
        `Preferred: Model ${fb.preferred}`,
        `Justification: ${fb.justification}`,
        '',
        `Model A Pros: ${fb.modelA?.pros || ''}`,
        `Model A Cons: ${fb.modelA?.cons || ''}`,
        `Model B Pros: ${fb.modelB?.pros || ''}`,
        `Model B Cons: ${fb.modelB?.cons || ''}`,
        '',
        'Axes:',
        ...Object.entries(AXIS_LABELS).map(([k, label]) => {
          const ax = (fb.axes || {})[k] || {};
          return `  ${label}: Winner=${ax.winner || 'tie'}, Score=${ax.preferredScore || 3}, Note="${ax.note || ''}"`;
        }),
      ].join('\n');
    }).join('\n\n');
  }

  function handleCopy() {
    navigator.clipboard.writeText(buildExportText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCreateTar() {
    if (!sourcePath.trim()) return setTarError('Enter the source repo path.');
    if (!outputPath.trim()) return setTarError('Enter the output .tar file path.');

    setTarLoading(true);
    setTarError('');
    setTarResult(null);

    try {
      const result = await apiFetch('/api/automation/tar', {
        method: 'POST',
        body: JSON.stringify({ source_path: sourcePath, output_path: outputPath }),
      });
      setTarResult(result);
    } catch (e) {
      setTarError(e.message);
    }
    setTarLoading(false);
  }

  return (
    <Layout step={4}>
      <div style={{ maxWidth: 700, margin: '40px auto 0' }}>

        {/* Summary */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>&#10003;</div>
          <h2 style={{ marginBottom: 8 }}>All Done</h2>
          <p style={{ color: 'var(--text2)', marginBottom: 20 }}>
            {total} interaction{total !== 1 ? 's' : ''} evaluated.
            <br />
            Model A preferred: <strong>{aWins}</strong> &mdash; Model B preferred: <strong>{bWins}</strong>
          </p>

          <div className="btn-row" style={{ justifyContent: 'center', marginBottom: 8 }}>
            <button className="btn btn-primary" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy All Feedback'}
            </button>
            <button className="btn btn-secondary" onClick={() => location.reload()}>
              Start New Task
            </button>
          </div>
        </div>

        {/* ── Tar file creation ── */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title">Create Tar Archive (for Revelo submission)</div>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
            Creates a <code>.tar</code> file of the repository folder as required by the task guidelines.
            Command: <code>tar cf output.tar name_of_directory</code>
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                Source repo directory
              </label>
              <input
                type="text"
                value={sourcePath}
                onChange={(e) => setSourcePath(e.target.value)}
                placeholder="/home/user/repos/my-project"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                Output .tar file path
              </label>
              <input
                type="text"
                value={outputPath}
                onChange={(e) => setOutputPath(e.target.value)}
                placeholder="/home/user/final_state.tar"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {tarError && <div className="alert alert-error" style={{ marginBottom: 10 }}>{tarError}</div>}

          {tarResult && (
            <div className="alert" style={{ marginBottom: 10, background: 'var(--green-dim)', color: 'var(--green)' }}>
              ✓ Created: <code>{tarResult.output_path}</code> ({tarResult.size_mb} MB)
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleCreateTar}
            disabled={tarLoading}
          >
            {tarLoading ? 'Creating tar...' : 'Create tar'}
          </button>
        </div>

        {/* Summary table */}
        {feedbacks.some(Boolean) && (
          <div className="card">
            <div className="card-title">Interaction Summary</div>
            <table className="axes-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Preferred</th>
                  <th>A Cons</th>
                  <th>B Cons</th>
                </tr>
              </thead>
              <tbody>
                {feedbacks.map((fb, i) => {
                  if (!fb) return null;
                  return (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td className={`winner-${fb.preferred?.toLowerCase()}`}>Model {fb.preferred}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--orange)' }}>
                        {fb.modelA?.cons || '—'}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--orange)' }}>
                        {fb.modelB?.cons || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </Layout>
  );
}
