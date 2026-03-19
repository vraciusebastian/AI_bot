/**
 * Returns the backend API base URL.
 * Priority:
 *   1. window.__API_BASE__  — injected by Electron preload (points to Windows server)
 *   2. NEXT_PUBLIC_API_URL  — build-time env var
 *   3. localhost:8000       — local dev fallback
 */
function getApiBase() {
  if (typeof window !== 'undefined' && window.__API_BASE__) {
    return window.__API_BASE__;
  }
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return 'http://localhost:8000';
}

export async function apiFetch(path, options = {}) {
  const url = `${getApiBase()}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try {
      const data = await res.json();
      msg = data.detail || msg;
    } catch {}
    throw new Error(msg);
  }

  return res.json();
}

export async function apiUpload(path, file) {
  const url = `${getApiBase()}${path}`;
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(url, { method: 'POST', body: form });

  if (!res.ok) {
    let msg = `Upload error ${res.status}`;
    try {
      const data = await res.json();
      msg = data.detail || msg;
    } catch {}
    throw new Error(msg);
  }

  return res.json();
}
