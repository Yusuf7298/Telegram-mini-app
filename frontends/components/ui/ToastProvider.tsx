"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { APP_TOAST_EVENT, ToastPayload, ToastType } from '@/lib/toast';

type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
  durationMs: number;
};

type ToastContextValue = {
  showToast: (payload: ToastPayload) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 4000;

function createToastId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `toast_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getToastStyle(type: ToastType) {
  if (type === 'success') {
    return 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100';
  }

  if (type === 'error') {
    return 'border-red-400/50 bg-red-500/15 text-red-100';
  }

  return 'border-sky-400/50 bg-sky-500/15 text-sky-100';
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Record<string, number>>({});

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const existing = timersRef.current[id];
    if (existing) {
      window.clearTimeout(existing);
      delete timersRef.current[id];
    }
  }, []);

  const showToast = useCallback(
    (payload: ToastPayload) => {
      const message = payload.message?.trim();
      if (!message) return;

      const id = createToastId();
      const durationMs = payload.durationMs ?? DEFAULT_DURATION_MS;
      const nextToast: ToastItem = {
        id,
        type: payload.type,
        message,
        durationMs,
      };

      setToasts((prev) => [...prev, nextToast].slice(-3));

      if (typeof window !== 'undefined') {
        const timerId = window.setTimeout(() => {
          removeToast(id);
        }, durationMs);
        timersRef.current[id] = timerId;
      }
    },
    [removeToast]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (event: Event) => {
      const custom = event as CustomEvent<ToastPayload>;
      if (!custom.detail) return;
      showToast(custom.detail);
    };

    window.addEventListener(APP_TOAST_EVENT, handler as EventListener);
    return () => {
      window.removeEventListener(APP_TOAST_EVENT, handler as EventListener);
      Object.values(timersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      timersRef.current = {};
    };
  }, [showToast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
        <div className="w-full max-w-md space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="status"
              aria-live="polite"
              className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur ${getToastStyle(toast.type)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="break-words">{toast.message}</span>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  className="min-h-[44px] min-w-[44px] shrink-0 rounded-md text-lg leading-none opacity-80 hover:opacity-100"
                  onClick={() => removeToast(toast.id)}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
}
