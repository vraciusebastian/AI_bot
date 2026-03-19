import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { apiFetch } from '../components/api';

export default function PlanPage() {
  const router = useRouter();
  const [promptText, setPromptText] = useState('');
  const [responseText, setResponseText] = useState('');
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const text = localStorage.getItem('prompt_text');
    if (text) setPromptText(text);

    // Check if session already has prompts
    const sessionId = localStorage.getItem('session_id');
    if (sessionId) {
      apiFetch(`/api/prompts/session/${sessionId}`)
        .then((session) => {
          if (session.prompts?.length > 0) {
            setPrompts(session.prompts);
          }
        })
        .catch(() => {});
    }
  }, []);

  function handleCopy() {
    navigator.clipboard.writeText(promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleParse() {
    if (!responseText.trim()) return setError('Paste Claude\'s response first.');

    setLoading(true);
    setError('');

    const sessionId = localStorage.getItem('session_id');

    try {
      const result = await apiFetch('/api/prompts/parse', {
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionId,
          response_text: responseText,
        }),
      });
      setPrompts(result.prompts);
      localStorage.setItem('prompts', JSON.stringify(result.prompts));
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  function handleStart() {
    localStorage.setItem('prompts', JSON.stringify(prompts));
    localStorage.setItem('current_interaction', '1');
    router.push('/interaction');
  }

  return (
    <Layout step={2}>
      <h2 style={{ marginBottom: 8 }}>Prompt Plan</h2>
      <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 24 }}>
        {prompts.length === 0
          ? 'Copy the prompt below into claude.ai, then paste back the response to get your 10 interaction prompts.'
          : `${prompts.length} prompts ready. Review them and start interacting.`
        }
      </p>

      {prompts.length === 0 ? (
        <>
          {/* Step 1: Copy prompt */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>
                Step 1: Copy this prompt to claude.ai
              </div>
              <button className="copy-btn" onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy to clipboard'}
              </button>
            </div>
            <textarea
              value={promptText}
              readOnly
              rows={12}
              style={{ fontSize: 12, background: 'var(--bg)' }}
            />
          </div>

          {/* Step 2: Paste response */}
          <div className="card">
            <div className="card-title">Step 2: Paste Claude's response</div>
            <textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              rows={10}
              placeholder="Paste the full response from claude.ai here (must contain a JSON array [...])"
            />

            {error && <div className="alert alert-error" style={{ marginTop: 10 }}>{error}</div>}

            <div style={{ marginTop: 12 }}>
              <button
                className="btn btn-primary"
                onClick={handleParse}
                disabled={loading}
              >
                {loading ? 'Parsing...' : 'Parse & Load Prompts'}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Show parsed prompts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {prompts.map((p) => (
              <div key={p.number} className="prompt-item">
                <div className="prompt-num">Interaction {p.number}</div>
                <div className="prompt-phase">{p.phase}</div>
                <div className="prompt-text">{p.prompt}</div>
              </div>
            ))}
          </div>

          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={handleStart}>
              Start Interactions →
            </button>
            <button className="btn btn-secondary" onClick={() => setPrompts([])}>
              Regenerate Prompts
            </button>
          </div>
        </>
      )}
    </Layout>
  );
}
