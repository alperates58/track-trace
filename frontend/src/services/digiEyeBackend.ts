const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export class DigiEyeBackendConnectionError extends Error {}

async function post(path: string, body: unknown) {
  const token = localStorage.getItem('tt_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
  } catch {
    throw new DigiEyeBackendConnectionError('Backend bağlantısı kesildi. Okunan kod Agent kuyruğunda korunuyor.');
  }

  if (response.status === 401) {
    localStorage.removeItem('tt_token');
    localStorage.removeItem('tt_user');
    window.location.reload();
    throw new DigiEyeBackendConnectionError('Oturum süresi doldu. Kod Agent kuyruğunda korunuyor.');
  }

  const payload = await response.json().catch(() => null);
  if (response.ok && payload) {
    return payload;
  }

  if (response.status === 400 && payload?.success === false) {
    return payload;
  }

  const detail = payload?.message || payload?.detail || payload?.title;
  throw new DigiEyeBackendConnectionError(`${detail || `Backend geçersiz yanıt verdi (${response.status}).`} Kod Agent kuyruğunda korunuyor.`);
}

export const digiEyeBackend = {
  openPrePrintedCarton(code: string, stationId: string) {
    return post('/api/scan/preprinted/open-carton', { code, stationId });
  },

  scanProduct(request: {
    orderId: string;
    rawCode: string;
    stationId: string;
    activeCartonId: string;
  }) {
    return post('/api/scan/product', {
      ...request,
      mode: 'PrePrinted'
    });
  }
};
