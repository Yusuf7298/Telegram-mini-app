import axios from 'axios';
import { env } from './env';
import { emitToast } from './toast';

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

if (env.NODE_ENV === 'production' && !env.API_BASE_URL.toLowerCase().startsWith('https://')) {
  throw new Error('NEXT_PUBLIC_API_URL must use HTTPS in production');
}

function resolveApiBaseUrl(): string {
  return env.API_BASE_URL.replace(/\/$/, '');
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
});

function mapApiErrorMessage(status?: number): string {
  if (status === 429) return 'Too many requests, wait';
  if (status === 409) return 'Duplicate request detected';
  if (status === 500) return 'Something went wrong';
  if (status === 401) return 'Unauthorized';
  return 'Something went wrong';
}

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('boxplay_token');
    const deviceId = getOrCreateDeviceId();

    config.headers = config.headers ?? {};

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (deviceId) {
      config.headers['X-Device-Id'] = deviceId;
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const endpoint = error?.config?.url || 'unknown-endpoint';
    const message = mapApiErrorMessage(status);

    console.error(`[API ERROR] ${endpoint}: ${message}`);

    emitToast({
      type: 'error',
      message,
    });

    if (typeof window !== 'undefined' && status === 401) {
      window.location.href = '/login';
    }

    return Promise.reject({
      status,
      endpoint,
      message,
    });
  }
);

export default api;
