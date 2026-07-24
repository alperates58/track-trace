const AGENT_BASE_URL = 'http://127.0.0.1:5000';

export interface DigiEyeConfig {
  enabled: boolean;
  cameraUrl: string;
  pollIntervalMs: number;
  requestTimeoutMs: number;
  releaseAfterMissedFrames: number;
  shadowMode: boolean;
  roiXPercent: number;
  roiYPercent: number;
  roiWidthPercent: number;
  roiHeightPercent: number;
}

export interface DigiEyeStatus {
  enabled: boolean;
  cameraConnected: boolean;
  shadowMode: boolean;
  cameraUrl: string;
  lastFrameAtUtc: string | null;
  lastDetectionAtUtc: string | null;
  lastDecodedCode: string | null;
  lastError: string | null;
  captureFramesPerSecond: number;
  lastDecodeMilliseconds: number;
  capturedFrames: number;
  decodedFrames: number;
  droppedFrames: number;
  detectedCodes: number;
  pendingEvents: number;
}

export interface DigiEyeEvent {
  sequence: number;
  rawCode: string;
  format: string;
  capturedAtUtc: string;
  decodeMilliseconds: number;
  source: string;
}

export class DigiEyeAgentError extends Error {
  constructor(message: string, public readonly httpStatus?: number) {
    super(message);
  }
}

function getToken(): string {
  const token = localStorage.getItem('tt_agent_token');
  if (!token) {
    throw new DigiEyeAgentError('Local Agent eşleştirme tokenı eksik. Yazdırma ayarlarından Agent tokenını kaydedin.');
  }
  return token;
}

async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${getToken()}`);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${AGENT_BASE_URL}${path}`, { ...options, headers, cache: 'no-store' });
  } catch {
    throw new DigiEyeAgentError("Local Agent'a ulaşılamıyor. Agent'ın kurulu ve çalışır durumda olduğunu kontrol edin.");
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const fallback = response.status === 401
      ? 'Local Agent tokenı geçersiz.'
      : `Local Agent isteği başarısız (${response.status}).`;
    throw new DigiEyeAgentError(payload?.message || fallback, response.status);
  }

  return response;
}

export const digiEyeAgent = {
  async getStatus(): Promise<DigiEyeStatus> {
    return (await request('/api/digieye/status')).json();
  },

  async getConfig(): Promise<DigiEyeConfig> {
    return (await request('/api/digieye/config')).json();
  },

  async updateConfig(config: DigiEyeConfig): Promise<DigiEyeConfig> {
    return (await request('/api/digieye/config', {
      method: 'POST',
      body: JSON.stringify(config)
    })).json();
  },

  async getEvents(limit = 25): Promise<DigiEyeEvent[]> {
    return (await request(`/api/digieye/events?after=0&limit=${limit}`)).json();
  },

  async acknowledge(sequence: number): Promise<void> {
    await request('/api/digieye/events/ack', {
      method: 'POST',
      body: JSON.stringify({ sequence })
    });
  },

  async getLatestFrame(): Promise<Blob | null> {
    try {
      return await (await request('/api/digieye/frame')).blob();
    } catch (error) {
      if (error instanceof DigiEyeAgentError && error.httpStatus === 404) {
        return null;
      }
      throw error;
    }
  }
};
