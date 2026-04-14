"use client";

import api from "@/lib/api";
import { User } from "@/lib/apiService";
import { ApiResponse } from '@/lib/apiTypes';
import { useAuthStore } from "@/store/authStore";

type TelegramLoginData = {
  token: string;
  user: User;
};

function extractBackendErrorMessage(error: unknown) {
  const fallback = "Login failed";
  if (typeof error !== "object" || error === null) {
    return fallback;
  }

  const maybeAny = error as {
    response?: {
      data?: {
        error?: {
          message?: string;
        } | string;
      };
    };
    message?: string;
  };

  const apiError = maybeAny.response?.data?.error;
  if (typeof apiError === "string" && apiError.trim()) {
    return apiError;
  }

  const nestedMessage =
    typeof apiError === "object" && apiError !== null
      ? apiError.message
      : undefined;

  if (typeof nestedMessage === "string" && nestedMessage.trim()) {
    return nestedMessage;
  }

  if (typeof maybeAny.message === "string" && maybeAny.message.trim()) {
    return maybeAny.message;
  }

  return fallback;
}

function getTelegramInitDataFromWindow() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.Telegram?.WebApp?.initData?.trim() || null;
}

export function useAuth() {
  const authUser = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);

  const loginWithTelegram = async () => {
    const initData = getTelegramInitDataFromWindow();
    if (!initData) {
      throw new Error("Telegram initData is missing");
    }

    try {
      const response = await api.post<ApiResponse<TelegramLoginData>>("/auth/telegram-login", {
        initData,
      });

      const payload = response.data.data;
      const nextToken = payload.token;
      const nextUser = payload.user;

      if (!nextToken || !nextUser) {
        throw new Error("Invalid authentication response");
      }

      login(nextUser, nextToken);
      return { user: nextUser, token: nextToken };
    } catch (error) {
      throw new Error(extractBackendErrorMessage(error));
    }
  };

  return {
    user: authUser,
    token,
    loginWithTelegram,
    logout,
  };
}
