import toast from 'react-hot-toast';

const BASE = '/api';

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    const msg = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  get: p => request(p),
  post: (p, body) => request(p, { method: 'POST', body: JSON.stringify(body) }),
  put: (p, body) => request(p, { method: 'PUT', body: JSON.stringify(body) }),
  del: p => request(p, { method: 'DELETE' }),
};

export function notifyError(err) {
  console.error(err);
  toast.error(err.message || 'Something went wrong');
}

export function notifySuccess(msg) {
  toast.success(msg);
}
