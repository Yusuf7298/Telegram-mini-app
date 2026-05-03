// Deterministic API Mock Layer
// Usage: import and call enableApiMockLayer({ mode: 'SLOW', delay: 3000 }) in test/dev only

export type ApiMockMode =
  | 'SUCCESS'
  | 'SLOW'
  | 'FAIL_ONCE_THEN_SUCCESS'
  | 'ALWAYS_FAIL'
  | 'VALIDATION_ERROR'
  | 'ALL_FAIL'
  | 'INTERMITTENT_FAIL_EVERY_2ND';

interface ApiMockConfig {
  mode: ApiMockMode;
  delay?: number; // ms for SLOW
  validationErrorMessage?: string;
  endpoints?: string[]; // If set, only mock these endpoints (glob or substring)
}

const state = {
  enabled: false,
  mode: 'SUCCESS' as ApiMockMode,
  delay: 2000,
  failOnceMap: new Map<string, boolean>(),
  // counter per endpoint for intermittent failures
  callCounters: new Map<string, number>(),
  validationErrorMessage: 'Validation failed',
  endpoints: undefined as string[] | undefined,
};

function shouldMock(url: string) {
  if (!state.endpoints) return true;
  return state.endpoints.some((e) => url.includes(e));
}

export function enableApiMockLayer(config: ApiMockConfig) {
  if (typeof window === 'undefined') return; // Only run in browser
  if (process.env.NODE_ENV === 'production' || window.__API_MOCK_LAYER_ENABLED) return;
  state.enabled = true;
  state.mode = config.mode;
  state.delay = config.delay ?? 2000;
  state.validationErrorMessage = config.validationErrorMessage || 'Validation failed';
  state.endpoints = config.endpoints;
  window.__API_MOCK_LAYER_ENABLED = true;

  const origFetch = window.fetch;
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!shouldMock(url)) return origFetch(input, init);
    // Update per-endpoint call counter
    const key = url;
    const prev = state.callCounters.get(key) || 0;
    state.callCounters.set(key, prev + 1);

    switch (state.mode) {
      case 'SUCCESS':
        return origFetch(input, init);
      case 'SLOW':
        await new Promise((r) => setTimeout(r, state.delay));
        return origFetch(input, init);
      case 'FAIL_ONCE_THEN_SUCCESS': {
        if (!state.failOnceMap.has(url)) {
          state.failOnceMap.set(url, true);
          return new Response(JSON.stringify({ message: 'Simulated error' }), { status: 500 });
        }
        return origFetch(input, init);
      }
      case 'ALWAYS_FAIL':
      case 'ALL_FAIL':
        return new Response(JSON.stringify({ message: 'Simulated error' }), { status: 500 });
      case 'INTERMITTENT_FAIL_EVERY_2ND': {
        // Fail every 2nd request for this endpoint
        const count = state.callCounters.get(key) || 0;
        if (count % 2 === 0) {
          return new Response(JSON.stringify({ message: 'Simulated intermittent failure' }), { status: 502 });
        }
        return origFetch(input, init);
      }
      case 'VALIDATION_ERROR':
        return new Response(JSON.stringify({ message: state.validationErrorMessage }), { status: 400 });
      default:
        return origFetch(input, init);
    }
  };
}

// For Playwright: set window.__API_MOCK_LAYER_MODE before page load
export function setApiMockLayerMode(mode: ApiMockMode, opts?: { delay?: number; endpoints?: string[]; validationErrorMessage?: string }) {
  if (typeof window !== 'undefined') {
    window.__API_MOCK_LAYER_MODE = mode;
    if (opts?.delay) window.__API_MOCK_LAYER_DELAY = opts.delay;
    if (opts?.endpoints) window.__API_MOCK_LAYER_ENDPOINTS = opts.endpoints;
    if (opts?.validationErrorMessage) window.__API_MOCK_LAYER_VALIDATION_ERROR = opts.validationErrorMessage;
  }
}

// Auto-enable in dev/test if flag is set
if (typeof window !== 'undefined' && !window.__API_MOCK_LAYER_ENABLED) {
  const mode = (window.__API_MOCK_LAYER_MODE || process.env.API_MOCK_LAYER_MODE) as ApiMockMode;
  if (mode) {
    enableApiMockLayer({
      mode,
      delay: window.__API_MOCK_LAYER_DELAY || 2000,
      endpoints: window.__API_MOCK_LAYER_ENDPOINTS,
      validationErrorMessage: window.__API_MOCK_LAYER_VALIDATION_ERROR,
    });
  }
}

declare global {
  interface Window {
    __API_MOCK_LAYER_ENABLED?: boolean;
    __API_MOCK_LAYER_MODE?: ApiMockMode;
    __API_MOCK_LAYER_DELAY?: number;
    __API_MOCK_LAYER_ENDPOINTS?: string[];
    __API_MOCK_LAYER_VALIDATION_ERROR?: string;
  }
}
