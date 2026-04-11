"use client";

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { getTelegramInitData, getTelegramWebApp } from '@/lib/telegram';
import { useAuthStore } from '@/store/authStore';

const authRoutes = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-otp'];
const bootstrapFlagKey = 'boxplay_telegram_bootstrap_done';

export default function TelegramAuthBootstrap({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthRoute = authRoutes.some((route) => pathname?.startsWith(route));
  const token = useAuthStore((state) => state.token);
  const login = useAuthStore((state) => state.login);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      if (typeof window === 'undefined') {
        setReady(true);
        return;
      }

      const webApp = getTelegramWebApp();
      const initData = getTelegramInitData();
      const storedToken = localStorage.getItem('boxplay_token');
      const storedUser = localStorage.getItem('boxplay_user');

      if (storedToken && storedUser) {
        try {
          login(JSON.parse(storedUser), storedToken);
        } catch {
          localStorage.removeItem('boxplay_token');
          localStorage.removeItem('boxplay_user');
        }

        setReady(true);
        return;
      }

      if (!webApp || !initData) {
        setReady(true);
        return;
      }

      if (localStorage.getItem(bootstrapFlagKey) === initData) {
        setReady(true);
        return;
      }

      try {
        const { data } = await api.post('/auth/telegram-login', { initData });
        const authUser = data?.data?.user ?? data?.user;
        const authToken = data?.data?.token ?? data?.token;

        if (authUser && authToken) {
          login(authUser, authToken);
          localStorage.setItem(bootstrapFlagKey, initData);
          router.refresh();
        }
      } catch {
        // Leave the app usable even if Telegram auth cannot be completed.
      } finally {
        setReady(true);
      }
    };

    bootstrap();
  }, [login, router]);

  useEffect(() => {
    if (isAuthRoute && token) {
      router.replace('/');
    }
  }, [isAuthRoute, router, token]);

  if (!ready) {
    return null;
  }

  return <>{children}</>;
}
