import { create } from 'zustand';
import { User } from '@/lib/apiService';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('boxplay_token') : null,
  login: (user, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('boxplay_token', token);
      localStorage.setItem('boxplay_user', JSON.stringify(user));
    }

    set({ user, token });
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('boxplay_token');
      localStorage.removeItem('boxplay_user');
    }

    set({ user: null, token: null });
  },
}));
