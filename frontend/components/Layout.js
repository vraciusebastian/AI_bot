import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

const NAV_ITEMS = [
  { href: '/', label: 'Upload' },
  { href: '/github', label: 'GitHub' },
  { href: '/plan', label: 'Plan' },
  { href: '/interaction', label: 'Interact' },
];

export default function Layout({ children, step = 1 }) {
  const router = useRouter();
  const [serverUrl, setServerUrl] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (window.electronAPI) {
      window.electronAPI.getServerUrl().then(setServerUrl);
    } else {
      setServerUrl(window.__API_BASE__ || 'http://localhost:8000');
    }
  }, []);

  async function handleChangeUrl() {
    if (!window.electronAPI) return;
    const newUrl = await window.electronAPI.changeServerUrl();
    if (newUrl) setServerUrl(newUrl);
  }

  return (
    <div>
      <div className="header">
        <h1>Behavioral AI Bot</h1>
        <nav>
          {NAV_ITEMS.map((item) => (
            <span
              key={item.href}
              className={router.pathname === item.href ? 'active' : ''}
              onClick={() => router.push(item.href)}
            >
              {item.label}
            </span>
          ))}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {mounted && serverUrl && (
            <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'monospace' }}>
              {serverUrl}
            </span>
          )}
          {mounted && window.electronAPI && (
            <button className="copy-btn" onClick={handleChangeUrl}>
              Edit URL
            </button>
          )}
          <div className="step-dots">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`step-dot${s === step ? ' active' : ''}${s < step ? ' done' : ''}`}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="container">
        {children}
      </div>
    </div>
  );
}
