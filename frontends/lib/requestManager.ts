import { useEffect } from 'react';

// Request signature for deduplication
function getRequestKey(endpoint: string, method: string, payload?: any) {
  return `${method}:${endpoint}:${payload ? JSON.stringify(payload) : ''}`;
}

// Global state (module singleton)
const activeRequests = new Map<string, AbortController>();
const failedRequests = new Map<string, any>();
const retryCounts = new Map<string, number>();
let globalLoadingListeners: (() => void)[] = [];
let globalErrorListeners: (() => void)[] = [];

function notifyLoading() {
  globalLoadingListeners.forEach((fn) => fn());
}
function notifyError() {
  globalErrorListeners.forEach((fn) => fn());
}

export function onGlobalLoadingChange(fn: () => void) {
  globalLoadingListeners.push(fn);
  return () => {
    globalLoadingListeners = globalLoadingListeners.filter((cb) => cb !== fn);
  };
}
export function onGlobalErrorChange(fn: () => void) {
  globalErrorListeners.push(fn);
  return () => {
    globalErrorListeners = globalErrorListeners.filter((cb) => cb !== fn);
  };
}

export function getActiveRequestCount() {
  return activeRequests.size;
}
export function getFailedRequests() {
  return Array.from(failedRequests.entries());
}
export function getRetryCount(key: string) {
  return retryCounts.get(key) || 0;
}

export async function requestManagerFetch({
  endpoint,
  method = 'GET',
  payload,
  signal,
  maxRetries = 2,
  dedupe = true,
}: {
  endpoint: string;
  method?: string;
  payload?: any;
  signal?: AbortSignal;
  maxRetries?: number;
  dedupe?: boolean;
}) {
  const key = getRequestKey(endpoint, method, payload);
  if (dedupe && activeRequests.has(key)) {
    throw new Error('Duplicate request in-flight');
  }
  let controller: AbortController | undefined;
  if (!signal) {
    controller = new AbortController();
    signal = controller.signal;
  }
  activeRequests.set(key, controller!);
  notifyLoading();
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: payload ? JSON.stringify(payload) : undefined,
        signal,
      });
      if (!res.ok) throw { status: res.status, message: await res.text() };
      activeRequests.delete(key);
      failedRequests.delete(key);
      notifyLoading();
      notifyError();
      return await res.json();
    } catch (err) {
      attempt++;
      retryCounts.set(key, attempt);
      if (attempt > maxRetries || (err && err.name === 'AbortError')) {
        activeRequests.delete(key);
        failedRequests.set(key, err);
        notifyLoading();
        notifyError();
        throw err;
      }
    }
  }
}

// Cancel all in-flight requests (e.g., on route change)
export function cancelAllRequests() {
  for (const [, controller] of activeRequests) {
    controller.abort();
  }
  activeRequests.clear();
  notifyLoading();
}

// React hook for global loading indicator
export function useGlobalLoadingIndicator(setLoading: (loading: boolean) => void) {
  useEffect(() => {
    const update = () => setLoading(getActiveRequestCount() > 0);
    onGlobalLoadingChange(update);
    update();
    return () => {
      globalLoadingListeners = globalLoadingListeners.filter((cb) => cb !== update);
    };
  }, [setLoading]);
}

// React hook for global error state
export function useGlobalErrorState(setError: (err: any) => void) {
  useEffect(() => {
    const update = () => {
      const failed = getFailedRequests();
      setError(failed.length ? failed[0][1] : null);
    };
    onGlobalErrorChange(update);
    update();
    return () => {
      globalErrorListeners = globalErrorListeners.filter((cb) => cb !== update);
    };
  }, [setError]);
}
