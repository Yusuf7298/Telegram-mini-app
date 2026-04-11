// Telegram WebApp SDK integration
// https://core.telegram.org/bots/webapps

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}


// Minimal Telegram WebApp type
interface TelegramWebApp {
  expand?: () => void;
  disableClosingConfirmation?: () => void;
  setSwipeBackAllowed?: (allowed: boolean) => void;
  initData?: string;
  initDataUnsafe?: {
    user?: TelegramUser;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function getTelegramWebApp() {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

export function getTelegramUser(): TelegramUser | null {
  const tg = getTelegramWebApp();
  if (tg && tg.initDataUnsafe?.user) {
    return tg.initDataUnsafe.user as TelegramUser;
  }
  return null;
}

export function getTelegramInitData(): string | null {
  const tg = getTelegramWebApp();
  const initData = tg?.initData;

  if (typeof initData === 'string' && initData.trim().length > 0) {
    return initData;
  }

  return null;
}

export function expandTelegramApp() {
  const tg = getTelegramWebApp();
  if (tg && tg.expand) tg.expand();
}

export function disableTelegramSwipe() {
  const tg = getTelegramWebApp();
  if (tg && tg.disableClosingConfirmation) tg.disableClosingConfirmation();
  if (tg && tg.setSwipeBackAllowed) tg.setSwipeBackAllowed(false);
}

export async function sendTelegramUserIdToBackend(apiUrl: string) {
  const user = getTelegramUser();
  if (user) {
    await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUserId: user.id }),
    });
  }
}
