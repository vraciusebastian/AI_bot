import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
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

export default function InteractionPage() {
  const router = useRouter();
  const [current, setCurrent] = useState(1);
  const [prompts, setPrompts] = useState([]);
  const [promptUsed, setPromptUsed] = useState('');
  const [modelA, setModelA] = useState('');
  const [modelB, setModelB] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Feedback state
  const [feedbackPromptText, setFeedbackPromptText] = useState('');
  const [feedbackResponse, setFeedbackResponse] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [allFeedbacks, setAllFeedbacks] = useState([]);

  // File watcher state
  const [pathA, setPathA] = useState('');
  const [pathB, setPathB] = useState('');
  const [watcherConfigured, setWatcherConfigured] = useState(false);
  const [watching, setWatching] = useState(false);
  const [watchStatus, setWatchStatus] = useState({ file_a: null, file_b: null });
  const watchInterval = useRef(null);
  const watchSince = useRef(0);

  // Automation state
  const [xdotoolAvailable, setXdotoolAvailable] = useState(null);
  const [autoStatus, setAutoStatus] = useState('');

  // Copy state
  const [copied, setCopied] = useState('');

  useEffect(() => {
    const p = localStorage.getItem('prompts');
    if (p) setPrompts(JSON.parse(p));
    const c = parseInt(localStorage.getItem('current_interaction') || '1');
    setCurrent(c);
    const pa = localStorage.getItem('watcher_path_a') || '';
    const pb = localStorage.getItem('watcher_path_b') || '';
    setPathA(pa);
    setPathB(pb);
    checkXdotool();
  }, []);

  useEffect(() => {
    if (prompts.length > 0 && current <= prompts.length) {
      setPromptUsed(prompts[current - 1]?.prompt || '');
    }
    setModelA('');
    setModelB('');
    setFeedback(null);
    setFeedbackPromptText('');
    setFeedbackResponse('');
    setError('');
    setWatchStatus({ file_a: null, file_b: null });
    stopWatching();
    // Reset since-timestamp so we wait for fresh writes
    watchSince.current = Date.now() / 1000 - 5;
  }, [current, prompts]);

  async function checkXdotool() {
    try {
      const r = await apiFetch('/api/automation/status');
      setXdotoolAvailable(r.xdotool_available);
    } catch {
      setXdotoolAvailable(false);
    }
  }

  function handleCopy(text, label) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  }

  // ── File watcher ──────────────────────────────────────────────────────────

  async function handleConfigureWatcher() {
    if (!pathA.trim() && !pathB.trim()) return setError('Enter at least one repo path.');
    const sessionId = localStorage.getItem('session_id');
    try {
      await apiFetch('/api/watcher/configure', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, path_a: pathA, path_b: pathB }),
      });
      localStorage.setItem('watcher_path_a', pathA);
      localStorage.setItem('watcher_path_b', pathB);
      setWatcherConfigured(true);
      setError('');
    } catch (e) {
      setError('Watcher config failed: ' + e.message);
    }
  }

  const pollFiles = useCallback(async () => {
    const sessionId = localStorage.getItem('session_id');
    try {
      const r = await apiFetch(
        `/api/watcher/check?session_id=${sessionId}&since=${watchSince.current}`
      );
      setWatchStatus(r);

      if (r.both_ready) {
        stopWatching();
        // Auto-populate textareas
        if (r.file_a?.content) setModelA(r.file_a.content);
        if (r.file_b?.content) setModelB(r.file_b.content);
        // Update timestamp so next interaction waits for fresh writes
        watchSince.current = Math.max(r.file_a?.mtime || 0, r.file_b?.mtime || 0);
      }
    } catch {}
  }, []);

  function startWatching() {
    if (watchInterval.current) clearInterval(watchInterval.current);
    setWatching(true);
    pollFiles();
    watchInterval.current = setInterval(pollFiles, 2000);
  }

  function stopWatching() {
    if (watchInterval.current) {
      clearInterval(watchInterval.current);
      watchInterval.current = null;
    }
    setWatching(false);
  }

  useEffect(() => () => stopWatching(), []);

  // ── Terminal automation ───────────────────────────────────────────────────

  async function autoType(text, pressEnter = false, delayMs = 0) {
    if (!xdotoolAvailable) {
      setAutoStatus('xdotool not available');
      return;
    }
    try {
      setAutoStatus('Typing...');
      await apiFetch('/api/automation/type', {
        method: 'POST',
        body: JSON.stringify({ text, press_enter: pressEnter, delay_ms: delayMs }),
      });
      setAutoStatus('Done');
      setTimeout(() => setAutoStatus(''), 1500);
    } catch (e) {
      setAutoStatus('Error: ' + e.message);
    }
  }

  // ── Feedback generation ───────────────────────────────────────────────────

  async function handleGenerateFeedback() {
    if (!promptUsed.trim()) return setError('Enter the prompt.');
    if (!modelA.trim()) return setError('Paste Model A response.');
    if (!modelB.trim()) return setError('Paste Model B response.');

    setLoading(true);
    setError('');
    setFeedback(null);

    const sessionId = localStorage.getItem('session_id');
    try {
      const result = await apiFetch('/api/feedback/generate', {
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionId,
          interaction_number: current,
          prompt_used: promptUsed,
          model_a_response: modelA,
          model_b_response: modelB,
        }),
      });
      setFeedbackPromptText(result.prompt_text);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function handleParseFeedback() {
    if (!feedbackResponse.trim()) return setError("Paste Claude's response first.");
    setLoading(true);
    setError('');

    const sessionId = localStorage.getItem('session_id');
    try {
      const result = await apiFetch('/api/feedback/parse', {
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionId,
          interaction_number: current,
          prompt_used: promptUsed,
          response_text: feedbackResponse,
        }),
      });
      setFeedback(result.feedback);
      setAllFeedbacks((prev) => {
        const next = [...prev];
        next[current - 1] = result.feedback;
        return next;
      });
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  function handleNext() {
    if (current >= 10) {
      localStorage.setItem('all_feedbacks', JSON.stringify(allFeedbacks));
      router.push('/done');
      return;
    }
    const next = current + 1;
    setCurrent(next);
    localStorage.setItem('current_interaction', String(next));
  }

  const pct = (current / 10) * 100;
  const phase = prompts[current - 1]?.phase || '';

  // Build an ordered list of terminal inputs for current feedback
  function buildTerminalLines(fb) {
    if (!fb) return [];
    const lines = [];
    lines.push({ label: 'Preferred (A or B)', value: fb.preferred || 'A', key: 'preferred' });
    lines.push({ label: 'Justification', value: fb.justification || '', key: 'just' });
    lines.push({ label: 'Model A — Pros', value: fb.modelA?.pros || '', key: 'a-pros' });
    lines.push({ label: 'Model A — Cons', value: fb.modelA?.cons || '', key: 'a-cons' });
    lines.push({ label: 'Model B — Pros', value: fb.modelB?.pros || '', key: 'b-pros' });
    lines.push({ label: 'Model B — Cons', value: fb.modelB?.cons || '', key: 'b-cons' });
    Object.entries(AXIS_LABELS).forEach(([k, label]) => {
      const ax = (fb.axes || {})[k] || {};
      lines.push({
        label: `Axis: ${label}`,
        value: `${ax.winner || 'tie'} | score: ${ax.preferredScore || 3} | ${ax.note || ''}`,
        key: k,
      });
    });
    return lines;
  }

  const terminalLines = buildTerminalLines(feedback);

  return (
    <Layout step={3}>
      {/* Progress */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Interaction {current} / 10</span>
          {phase && <span className="phase-badge">{phase}</span>}
        </div>
        <div className="progress-bar-wrap">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* ── File Watcher ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 8 }}>
          Auto-read 1.txt from repos
          {watchStatus.both_ready && (
            <span style={{ marginLeft: 10, color: 'var(--green)', fontSize: 12 }}>✓ Both files loaded</span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
              Repo A path (folder or 1.txt file)
            </label>
            <input
              type="text"
              value={pathA}
              onChange={(e) => setPathA(e.target.value)}
              placeholder="/home/user/repos/project-a"
              style={{ width: '100%' }}
            />
            {watchStatus.file_a && (
              <div style={{ fontSize: 11, marginTop: 4, color: watchStatus.file_a.ready ? 'var(--green)' : 'var(--text2)' }}>
                {watchStatus.file_a.ready ? `✓ ${watchStatus.file_a.path}` : `⏳ ${watchStatus.file_a.reason}`}
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
              Repo B path (folder or 1.txt file)
            </label>
            <input
              type="text"
              value={pathB}
              onChange={(e) => setPathB(e.target.value)}
              placeholder="/home/user/repos/project-b"
              style={{ width: '100%' }}
            />
            {watchStatus.file_b && (
              <div style={{ fontSize: 11, marginTop: 4, color: watchStatus.file_b.ready ? 'var(--green)' : 'var(--text2)' }}>
                {watchStatus.file_b.ready ? `✓ ${watchStatus.file_b.path}` : `⏳ ${watchStatus.file_b.reason}`}
              </div>
            )}
          </div>
        </div>

        <div className="btn-row">
          {!watcherConfigured ? (
            <button className="btn btn-secondary" onClick={handleConfigureWatcher}>
              Save Paths
            </button>
          ) : watching ? (
            <button className="btn btn-secondary" onClick={stopWatching}>
              ⏹ Stop Watching
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={startWatching}>
              👁 Watch for 1.txt (polls every 2s)
            </button>
          )}
          {watching && (
            <span style={{ fontSize: 12, color: 'var(--text2)', alignSelf: 'center' }}>
              Watching… waiting for both files to be written
            </span>
          )}
        </div>
      </div>

      {/* Prompt */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Prompt</div>
          <button className="copy-btn" onClick={() => handleCopy(promptUsed, 'prompt')}>
            {copied === 'prompt' ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <textarea
          value={promptUsed}
          onChange={(e) => setPromptUsed(e.target.value)}
          rows={4}
          placeholder="The suggested prompt (editable)"
        />
      </div>

      {/* Model responses */}
      <div className="models-grid">
        <div className="model-card model-a">
          <div className="model-label">
            Model A Response
            {watchStatus.file_a?.ready && (
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--green)' }}>auto-loaded</span>
            )}
          </div>
          <textarea
            value={modelA}
            onChange={(e) => setModelA(e.target.value)}
            placeholder="Paste Model A's response, or use the file watcher above..."
          />
        </div>
        <div className="model-card model-b">
          <div className="model-label">
            Model B Response
            {watchStatus.file_b?.ready && (
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--green)' }}>auto-loaded</span>
            )}
          </div>
          <textarea
            value={modelB}
            onChange={(e) => setModelB(e.target.value)}
            placeholder="Paste Model B's response, or use the file watcher above..."
          />
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

      {/* Generate feedback button */}
      {!feedbackPromptText && !feedback && (
        <div className="btn-row" style={{ marginBottom: 16 }}>
          <button
            className="btn btn-primary"
            onClick={handleGenerateFeedback}
            disabled={loading}
          >
            {loading ? 'Building prompt...' : 'Generate Feedback'}
          </button>
        </div>
      )}

      {/* Feedback prompt to copy to claude.ai */}
      {feedbackPromptText && !feedback && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>
              Copy this to claude.ai for evaluation
            </div>
            <button
              className="copy-btn"
              onClick={() => handleCopy(feedbackPromptText, 'fb-prompt')}
            >
              {copied === 'fb-prompt' ? 'Copied!' : 'Copy to clipboard'}
            </button>
          </div>
          <textarea
            value={feedbackPromptText}
            readOnly
            rows={6}
            style={{ fontSize: 11, background: 'var(--bg)', marginBottom: 12 }}
          />

          <div className="card-title">Paste Claude's evaluation response</div>
          <textarea
            value={feedbackResponse}
            onChange={(e) => setFeedbackResponse(e.target.value)}
            rows={8}
            placeholder="Paste the JSON response from claude.ai here..."
          />

          <div style={{ marginTop: 10 }}>
            <button className="btn btn-primary" onClick={handleParseFeedback} disabled={loading}>
              {loading ? 'Parsing...' : 'Parse Feedback'}
            </button>
          </div>
        </div>
      )}

      {/* ── Feedback display ── */}
      {feedback && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">Feedback</div>

          <div className={`preferred-banner prefer-${feedback.preferred?.toLowerCase()}`}>
            <span style={{ fontSize: 18 }}>{feedback.preferred === 'A' ? '🟣' : '🔵'}</span>
            <div>
              <div style={{ fontWeight: 600 }}>Preferred: Model {feedback.preferred}</div>
              <div className="justification-text">{feedback.justification}</div>
            </div>
          </div>

          <div className="feedback-grid">
            {['A', 'B'].map((m) => {
              const key = `model${m}`;
              const data = feedback[key] || {};
              return (
                <div key={m} className="fb-block">
                  <div className={`fb-label ${m.toLowerCase()}`}>Model {m}</div>
                  <div className="fb-section">
                    <div className="fb-section-title">Pros</div>
                    <div className="fb-pros">{data.pros || '—'}</div>
                  </div>
                  <div className="fb-section">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div className="fb-section-title" style={{ marginBottom: 0 }}>Cons</div>
                      {data.cons && (
                        <button className="copy-btn" onClick={() => handleCopy(data.cons, `cons-${m}`)}>
                          {copied === `cons-${m}` ? 'Copied!' : 'Copy'}
                        </button>
                      )}
                    </div>
                    <div className={`fb-cons${data.cons ? '' : ' empty'}`}>
                      {data.cons || 'No issues'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="fb-section-title" style={{ marginBottom: 10 }}>Axes Evaluation</div>
          <table className="axes-table">
            <thead>
              <tr><th>Dimension</th><th>Winner</th><th>Score</th><th>Note</th></tr>
            </thead>
            <tbody>
              {Object.entries(AXIS_LABELS).map(([key, label]) => {
                const ax = (feedback.axes || {})[key] || {};
                const w = ax.winner || 'tie';
                const score = ax.preferredScore || 3;
                return (
                  <tr key={key}>
                    <td>{label}</td>
                    <td className={`winner-${w.toLowerCase()}`}>{w === 'tie' ? 'Tie' : `Model ${w}`}</td>
                    <td>
                      <span className={`score-badge score-${Math.min(5, Math.max(1, score))}`}>{score}</span>
                    </td>
                    <td style={{ color: 'var(--text2)', fontSize: 12 }}>{ax.note || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* ── Terminal Automation Panel ── */}
          <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div className="fb-section-title" style={{ marginBottom: 0 }}>
                Terminal Automation (xdotool)
              </div>
              <span style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 4,
                background: xdotoolAvailable ? 'var(--green-dim)' : 'var(--red-dim)',
                color: xdotoolAvailable ? 'var(--green)' : 'var(--red)',
              }}>
                {xdotoolAvailable === null ? 'checking...' : xdotoolAvailable ? 'xdotool ready' : 'xdotool not installed'}
              </span>
              {autoStatus && (
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>{autoStatus}</span>
              )}
            </div>

            {!xdotoolAvailable && (
              <div className="alert" style={{ marginBottom: 10, fontSize: 12 }}>
                Install xdotool to auto-type: <code>sudo apt install xdotool</code>
              </div>
            )}

            <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>
              Click each button after the terminal prompts you for that value.
              Each button types the text into the currently focused window.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {terminalLines.map((line) => (
                <div key={line.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ width: 180, flexShrink: 0, fontSize: 12, color: 'var(--text2)', paddingTop: 6 }}>
                    {line.label}
                  </div>
                  <div style={{
                    flex: 1, fontSize: 12, fontFamily: 'monospace',
                    background: 'var(--bg)', padding: '4px 8px', borderRadius: 4,
                    border: '1px solid var(--border)', wordBreak: 'break-word',
                  }}>
                    {line.value}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      className="copy-btn"
                      onClick={() => handleCopy(line.value, line.key)}
                    >
                      {copied === line.key ? '✓' : 'Copy'}
                    </button>
                    <button
                      className="copy-btn"
                      style={{ background: xdotoolAvailable ? 'var(--accent-dim)' : 'var(--bg2)' }}
                      onClick={() => autoType(line.value, true)}
                      disabled={!xdotoolAvailable}
                    >
                      Type↵
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick-select A/B */}
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>Preferred model quick-type:</span>
              {['A', 'B', 'a', 'b', 'AA', 'BB'].map((v) => (
                <button
                  key={v}
                  className="copy-btn"
                  style={{ fontWeight: 600 }}
                  onClick={() => autoType(v, true)}
                  disabled={!xdotoolAvailable}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="btn-row" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
            <button
              className={`btn ${current >= 10 ? 'btn-success' : 'btn-primary'}`}
              onClick={handleNext}
            >
              {current >= 10 ? 'Finish All Interactions' : 'Next Interaction →'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
