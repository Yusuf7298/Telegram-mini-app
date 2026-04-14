import { create } from 'zustand';
import { User } from '@/lib/apiService';
import {
  clearStoredAuthSession,
  getStoredToken,
  getStoredUser,
  storeAuthSession,
} from '@/lib/tokenStorage';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: getStoredUser(),
  token: getStoredToken(),
  login: (user, token) => {
    storeAuthSession(token, user);

    set({ user, token });
  },
  logout: () => {
    clearStoredAuthSession();

    set({ user: null, token: null });
  },
}));
