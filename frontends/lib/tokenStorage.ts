import { User, UserRole } from '@/lib/apiService';

export const AUTH_TOKEN_KEY = 'boxplay_token';
export const AUTH_USER_KEY = 'boxplay_user';

const VALID_ROLES: readonly UserRole[] = ['USER', 'ADMIN'];

function isBrowser() {
  return typeof window !== 'undefined';
}

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && VALID_ROLES.includes(value as UserRole);
}

function isStoredUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<User>;

  return (
    typeof candidate.id === 'string' &&
    isUserRole(candidate.role) &&
    typeof candidate.username === 'string' &&
    typeof candidate.phone === 'string' &&
    (candidate.avatar === undefined || typeof candidate.avatar === 'string')
  );
}

export function getStoredToken(): string | null {
  if (!isBrowser()) {
    return null;
  }

  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getStoredUser(): User | null {
  if (!isBrowser()) {
    return null;
  }

  const rawUser = localStorage.getItem(AUTH_USER_KEY);
  if (!rawUser) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(rawUser);
    return isStoredUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function storeAuthSession(token: string, user: User) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function clearStoredAuthSession() {
  if (!isBrowser()) {
    return;
  }

  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}
