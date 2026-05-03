import React from 'react';

type FallbackErrorVariant = 'network' | 'server' | 'validation' | 'default';

function mapErrorToVariant(message?: string, code?: string | number): FallbackErrorVariant {
  if (!message && !code) return 'default';
  if (typeof code === 'number') {
    if ([408, 429, 502, 503, 504].includes(code)) return 'network';
    if (code >= 500) return 'server';
    if (code >= 400 && code < 500) return 'validation';
  }
  if (/network|timeout|temporarily unavailable|ECONNRESET/i.test(message || '')) return 'network';
  if (/validation|invalid|required|format|missing/i.test(message || '')) return 'validation';
  if (/server|internal|unexpected/i.test(message || '')) return 'server';
  return 'default';
}

const variantTitles: Record<FallbackErrorVariant, string> = {
  network: 'Network Error',
  server: 'Server Error',
  validation: 'Validation Error',
  default: 'Something went wrong',
};

const variantMessages: Record<FallbackErrorVariant, string> = {
  network: 'Network issue detected. Please check your connection and try again.',
  server: 'A server error occurred. Please try again later.',
  validation: 'There was a problem with your input. Please review and try again.',
  default: 'Please try again later.',
};

export function FallbackError({ message, code, onRetry }: { message?: string; code?: string | number; onRetry?: () => void }) {
  const variant = mapErrorToVariant(message, code);
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center text-red-600">
      <div className="text-lg font-semibold mb-2">{variantTitles[variant]}</div>
      <div className="mb-4">{message || variantMessages[variant]}</div>
      {onRetry && (
        <button
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          onClick={onRetry}
        >
          Retry
        </button>
      )}
    </div>
  );
}
