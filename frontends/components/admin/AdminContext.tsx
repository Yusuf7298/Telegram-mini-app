"use client";

import { createContext, useContext, useMemo, useState } from 'react';

type AdminContextValue = {
  adminSecret: string;
  setAdminSecret: (value: string) => void;
};

const STORAGE_KEY = 'boxplay_admin_secret';

const AdminContext = createContext<AdminContextValue | null>(null);

function getStoredAdminSecret() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY) ?? '';
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [adminSecret, setAdminSecretState] = useState<string>(() => getStoredAdminSecret());

  const setAdminSecret = (value: string) => {
    setAdminSecretState(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, value);
    }
  };

  const value = useMemo(() => ({ adminSecret, setAdminSecret }), [adminSecret]);

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdminContext() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdminContext must be used within AdminProvider');
  }

  return context;
}
