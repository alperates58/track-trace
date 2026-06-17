const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('tt_token');
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Set Content-Type to application/json only if it's not a FormData object (for file uploads)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && path !== '/api/auth/login') {
    localStorage.removeItem('tt_token');
    localStorage.removeItem('tt_user');
    window.location.reload();
    throw new Error('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
  }

  // Handle PDF/binary downloads
  const contentType = response.headers.get('Content-Type');
  if (contentType && (
    contentType.includes('application/pdf') || 
    contentType.includes('application/zip') || 
    contentType.includes('application/octet-stream') ||
    contentType.startsWith('image/')
  )) {
    return response.blob();
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `İstek başarısız oldu (Hata Kodu: ${response.status})`);
  }

  // If there's no content
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  get: (path: string) => request(path, { method: 'GET' }),
  post: (path: string, body?: any) => request(path, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
  }),
  put: (path: string, body?: any) => request(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
};
