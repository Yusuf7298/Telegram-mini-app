"use client";

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ApiResponse } from '@/lib/apiTypes';
import { User } from '@/lib/apiService';
import { getTelegramInitData, getTelegramWebApp } from '@/lib/telegram';
import { getStoredToken, getStoredUser } from '@/lib/tokenStorage';
import { useAuthStore } from '@/store/authStore';
import { applyReferralCode } from '@/lib/referralApi';

const authRoutes = ['/login', '/signup'];
const bootstrapFlagKey = 'boxplay_telegram_bootstrap_done';
const referralPendingKey = 'boxplay_referral_pending_code';
const referralAppliedKey = 'boxplay_referral_applied_code';

type TelegramLoginData = {
  token: string;
  user: User;
};

export default function TelegramAuthBootstrap({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthRoute = authRoutes.some((route) => pathname?.startsWith(route));
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && ref.trim()) {
      localStorage.setItem(referralPendingKey, ref.trim().toUpperCase());
    }
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      if (typeof window === 'undefined') {
        setReady(true);
        return;
      }

      const webApp = getTelegramWebApp();
      const initData = getTelegramInitData();
      const storedToken = getStoredToken();
      const storedUser = getStoredUser();

      if (storedToken && storedUser) {
        login(storedUser, storedToken);

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
        const { data } = await api.post<ApiResponse<TelegramLoginData>>('/auth/telegram-login', { initData });
        const authUser = data.data.user;
        const authToken = data.data.token;

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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const pendingReferralCode = localStorage.getItem(referralPendingKey)?.trim().toUpperCase() || '';
    const appliedReferralCode = localStorage.getItem(referralAppliedKey)?.trim().toUpperCase() || '';

    if (!pendingReferralCode || pendingReferralCode === appliedReferralCode) {
      return;
    }

    if (!token || !user) {
      return;
    }

    if (user.referralCode && user.referralCode.toUpperCase() === pendingReferralCode) {
      localStorage.setItem(referralAppliedKey, pendingReferralCode);
      return;
    }

    let cancelled = false;

    // Single-use referral attribution flow
    const applySingleUseReferral = async () => {
      const initData = getTelegramInitData();
      if (!initData) {
        return;
      }

      try {
        await applyReferralCode(pendingReferralCode, initData);
        if (!cancelled) {
          localStorage.setItem(referralAppliedKey, pendingReferralCode);
          localStorage.removeItem(referralPendingKey);
        }
      } catch {
        // Keep the pending code for a later retry, but do not loop-submit.
      }
    };

    void applySingleUseReferral();

    return () => {
      cancelled = true;
    };
  }, [token, user]);

  if (!ready) {
    return null;
  }

  return <>{children}</>;
}
