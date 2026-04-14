export type ToastType = 'success' | 'error' | 'info';

export type ToastPayload = {
  type: ToastType;
  message: string;
  durationMs?: number;
};

export const APP_TOAST_EVENT = 'app:toast';

export function emitToast(payload: ToastPayload) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ToastPayload>(APP_TOAST_EVENT, { detail: payload }));
}
