import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { apiFetch, apiUpload } from '../components/api';

export default function UploadPage() {
  const router = useRouter();
  const fileRef = useRef(null);
  const [docs, setDocs]           = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState('');
  const [dragover, setDragover]   = useState(false);
  const [urlInput, setUrlInput]   = useState('');
  const [urlSaving, setUrlSaving] = useState(false);

  useEffect(() => {
    loadDocs();
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.getServerUrl().then(setUrlInput);
    } else {
      setUrlInput(window.__API_BASE__ || 'http://localhost:8000');
    }
  }, []);

  async function loadDocs() {
    setError('');
    try {
      const data = await apiFetch('/api/documents/');
      setDocs(data);
    } catch {
      setError('Could not reach the backend.');
    }
  }

  async function handleSaveUrl() {
    const trimmed = urlInput.trim().replace(/\/$/, '');
    if (!trimmed) return;
    if (window.electronAPI) {
      setUrlSaving(true);
      await window.electronAPI.setServerUrl(trimmed);
      // page will reload automatically
    }
  }

  async function handleUpload(file) {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      await apiUpload('/api/documents/upload', file);
      await loadDocs();
    } catch (e) {
      setError(e.message);
    }
    setUploading(false);
  }

  async function handleDelete(id) {
    try {
      await apiFetch(`/api/documents/${id}`, { method: 'DELETE' });
      await loadDocs();
    } catch (e) {
      setError(e.message);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragover(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleUpload(file);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  return (
    <Layout step={1}>
      <div className="center-content">
        <h2 style={{ marginBottom: 8 }}>Upload Requirements</h2>
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 24 }}>
          Upload your task requirement documentation. It will be stored in the database
          and used to generate better debugging prompts.
        </p>

        {/* Server URL editor */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title">Server URL</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveUrl()}
              placeholder="http://192.168.1.105:8000"
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-primary"
              onClick={handleSaveUrl}
              disabled={urlSaving || !urlInput.trim()}
            >
              {urlSaving ? 'Saving…' : 'Save & Reconnect'}
            </button>
            <button className="btn btn-secondary" onClick={loadDocs}>
              Retry
            </button>
          </div>
        </div>

        <div
          className={`upload-zone${dragover ? ' dragover' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
          onDragLeave={() => setDragover(false)}
          onDrop={onDrop}
        >
          <div className="icon">+</div>
          <p>{uploading ? 'Uploading...' : 'Click or drag a file here'}</p>
          <div className="hint">.txt, .md, .pdf, .json, .html — any text file</div>
        </div>

        <input
          ref={fileRef}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => handleUpload(e.target.files?.[0])}
        />

        {error && (
          <div className="alert alert-error" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}

        {docs.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div className="card-title">Uploaded Documents</div>
            {docs.map((doc) => (
              <div key={doc.id} className="doc-item">
                <div>
                  <div className="doc-name">{doc.filename}</div>
                  <div className="doc-meta">
                    {formatSize(doc.size)} — {doc.has_text ? 'Text content extracted' : 'Binary'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-small btn-secondary"
                    onClick={() => {
                      localStorage.setItem('selected_doc_id', doc.id);
                      router.push('/github');
                    }}
                  >
                    Use This & Continue
                  </button>
                  <button
                    className="btn btn-small btn-secondary"
                    style={{ color: 'var(--red)' }}
                    onClick={() => handleDelete(doc.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button className="btn btn-secondary" onClick={() => router.push('/github')}>
            Skip — Continue Without Document
          </button>
        </div>
      </div>
    </Layout>
  );
}
