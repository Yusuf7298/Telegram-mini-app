import { apiRequestWithRetry } from './apiErrorHandler';
import { env } from './env';

const DEVICE_ID_STORAGE_KEY = 'boxplay_device_id';
function getOrCreateDeviceId(): string | null {
  if (typeof window === 'undefined') return null;
  const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing && existing.trim()) return existing;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    const generated = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  }
  return null;
}

function resolveApiBaseUrl(): string {
  const apiBaseUrl = env.API_BASE_URL?.trim();
  if (apiBaseUrl) {
    if (env.NODE_ENV === 'production' && !apiBaseUrl.toLowerCase().startsWith('https://')) {
      return 'https://localhost:5000/api';
    }
    return apiBaseUrl.replace(/\/$/, '');
  }
  return 'https://localhost:5000/api';
}

async function request(method: string, url: string, data?: any, config?: any) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('boxplay_token');
    const deviceId = getOrCreateDeviceId();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (deviceId) headers['X-Device-Id'] = deviceId;
  }
  const opts: RequestInit = {
    method,
    headers,
    credentials: 'include',
    ...(data ? { body: JSON.stringify(data) } : {}),
    ...(config || {}),
  };
  const baseUrl = resolveApiBaseUrl();
  const fullUrl = url.startsWith('http') ? url : baseUrl + url;
  return apiRequestWithRetry(async () => {
    // Offline detection
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && !navigator.onLine) {
      const err: any = { status: 0, message: 'Offline', isTransient: true };
      throw err;
    }

    // Dev-only: simulate slow network if env flag set
    try {
      const simulate = (globalThis as any)?.NEXT_PUBLIC_SIMULATE_NETWORK_SLOW || (typeof window !== 'undefined' && (window as any).NEXT_PUBLIC_SIMULATE_NETWORK_SLOW);
      if (simulate === '1' || simulate === 1 || simulate === true) {
        // small variable delay to simulate slowness
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 1200 + Math.floor(Math.random() * 800)));
      }
    } catch {
      // ignore
    }

    const res = await fetch(fullUrl, opts);
    const contentType = res.headers.get('content-type') || '';
    let body: any = null;
    if (contentType.includes('application/json')) {
      body = await res.json();
    } else {
      body = await res.text();
    }
    if (!res.ok) {
      const error = { status: res.status, message: body?.message || res.statusText, isTransient: [408, 429, 502, 503, 504].includes(res.status) };
      throw error;
    }
    return { data: body, status: res.status };
  }, (method === 'GET' || (method === 'POST' && (data?.idempotencyKey))), 8000);
}

const apiClient = {
  get: (url: string, config?: any) => request('GET', url, undefined, config),
  post: (url: string, data?: any, config?: any) => request('POST', url, data, config),
  put: (url: string, data?: any, config?: any) => request('PUT', url, data, config),
  delete: (url: string, config?: any) => request('DELETE', url, undefined, config),
};

export default apiClient;
