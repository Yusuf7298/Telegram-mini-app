import { useState, useCallback, useEffect } from 'react';
import { trackEvent, setPersistentWarningHandler } from './telemetry';

export type ApiError = {
  message: string;
  code?: string | number;
  status?: number;
  isTransient?: boolean;
};

export function isTransientError(error: ApiError) {
  return (
    error.isTransient ||
    [408, 429, 502, 503, 504].includes(error.status ?? 0) ||
    /timeout|network|temporarily unavailable|ECONNRESET/i.test(error.message)
  );
}

export async function apiRequestWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, timeoutMs = 8000): Promise<T> {
  let lastError: any;
  let attempt = 0;
  let delay = 400;
  while (attempt <= maxRetries) {
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Network timeout')), timeoutMs)),
      ]);
    } catch (err: any) {
      lastError = err;
      // Only retry for transient errors (5xx, network), not for 4xx/validation
      const status = err?.status || err?.code;
      const isValidation = status && status >= 400 && status < 500 && status !== 408 && status !== 429;
      if (!isTransientError(err) || isValidation || attempt === maxRetries) throw err;
      // Exponential backoff
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 4000); // cap backoff
      attempt++;
    }
  }
  throw lastError;
}
export function useApiErrorHandler() {
  const [error, setError] = useState<ApiError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [persistentWarning, setPersistentWarning] = useState<string | null>(null);

  // Register persistent warning handler once
  useEffect(() => {
    setPersistentWarningHandler((endpoint) => {
      setPersistentWarning(endpoint);
    });
  }, []);

  const handleError = (err: any, meta?: { endpoint?: string; method?: string; userId?: string }) => {
    // Normalize error for UI mapping
    let mapped: ApiError = { message: 'Unknown error' };
    if (err && typeof err === 'object') {
      mapped = {
        message: err.message || 'Unknown error',
        code: err.code ?? err.status,
        status: err.status,
        isTransient: err.isTransient,
      };
    } else if (typeof err === 'string') {
      mapped = { message: err };
    }
    setError(mapped);
    if (isTransientError(mapped)) setRetryCount((c) => c + 1);
    // Telemetry: track failed API call
    trackEvent('api_failure', {
      ...mapped,
      retryCount,
      endpoint: meta?.endpoint,
      method: meta?.method,
      userId: meta?.userId,
    });
  };

  const handleRetry = (meta?: { endpoint?: string; method?: string; userId?: string }) => {
    trackEvent('api_retry', {
      endpoint: meta?.endpoint,
      method: meta?.method,
      userId: meta?.userId,
    });
  };

  const handleUserActionFailed = (meta?: { endpoint?: string; method?: string; userId?: string }) => {
    trackEvent('user_action_failed', {
      endpoint: meta?.endpoint,
      method: meta?.method,
      userId: meta?.userId,
    });
  };

  const handleCriticalFlowError = (meta?: { endpoint?: string; method?: string; userId?: string }) => {
    trackEvent('critical_flow_error', {
      endpoint: meta?.endpoint,
      method: meta?.method,
      userId: meta?.userId,
    });
  };

  const clearError = () => setError(null);

  return {
    error,
    handleError,
    clearError,
    retryCount,
    persistentWarning,
    handleRetry,
    handleUserActionFailed,
    handleCriticalFlowError,
  };
}
