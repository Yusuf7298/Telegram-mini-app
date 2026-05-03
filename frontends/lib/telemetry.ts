// Telemetry utility for tracking API reliability and user flows
export type TelemetryEventType =
  | 'api_failure'
  | 'api_retry'
  | 'api_slow'
  | 'api_duplicate'
  | 'user_action_failed'
  | 'critical_flow_error';


// In-memory aggregation for client-side alerting
const apiFailureCounts: Record<string, number> = {};
const apiDuplicateCounts: Record<string, number> = {};
const apiRetryCounts: Record<string, number> = {};
const apiSlowCounts: Record<string, number> = {};
let persistentWarningHandler: ((endpoint: string) => void) | null = null;

// Utility: get or generate a session ID (per tab)
function getSessionId() {
  if (typeof window === 'undefined') return '';
  if (!(window as any).__SESSION_ID) {
    (window as any).__SESSION_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  return (window as any).__SESSION_ID;
}

// Utility: get user ID from global context if available
function getUserId() {
  if (typeof window !== 'undefined' && (window as any).userContext) {
    return (window as any).userContext.userId || '';
  }
  return '';
}

export function setPersistentWarningHandler(fn: (endpoint: string) => void) {
  persistentWarningHandler = fn;
}


export function trackEvent(
  event: TelemetryEventType,
  props?: {
    endpoint?: string;
    method?: string;
    retryCount?: number;
    userId?: string;
    responseTime?: number;
    isDuplicate?: boolean;
    duration?: number;
    [key: string]: any;
  }
) {
  const timestamp = Date.now();
  const sessionId = getSessionId();
  const userId = props?.userId || getUserId();
  const endpoint = props?.endpoint || '';
  const duration = typeof props?.duration === 'number' ? props.duration : props?.responseTime;
  const payload = { ...props, timestamp, sessionId, userId, endpoint, duration };

  // Consistent, minimal log for all events
  if (typeof window !== 'undefined' && (window as any).telemetry) {
    (window as any).telemetry.track(event, payload);
  } else {
    // eslint-disable-next-line no-console
    console.info('[telemetry]', event, payload);
  }

  // Aggregation: count failures per endpoint and detect spikes
  if (event === 'api_failure' && endpoint) {
    apiFailureCounts[endpoint] = (apiFailureCounts[endpoint] || 0) + 1;
    if (apiFailureCounts[endpoint] >= 3 && persistentWarningHandler) {
      persistentWarningHandler(endpoint);
    }
  }

  // Track duplicate API calls
  if (event === 'api_duplicate' && endpoint) {
    apiDuplicateCounts[endpoint] = (apiDuplicateCounts[endpoint] || 0) + 1;
  }

  // Track retries
  if (event === 'api_retry' && endpoint) {
    apiRetryCounts[endpoint] = (apiRetryCounts[endpoint] || 0) + 1;
  }

  // Track slow responses
  if ((event === 'api_slow' || (duration && duration > 2000)) && endpoint) {
    apiSlowCounts[endpoint] = (apiSlowCounts[endpoint] || 0) + 1;
    // Optionally emit a slow log event if not already
    if (event !== 'api_slow') {
      // eslint-disable-next-line no-console
      console.warn('[telemetry] api_slow', { endpoint, duration, sessionId, userId, timestamp });
    }
  }
}
