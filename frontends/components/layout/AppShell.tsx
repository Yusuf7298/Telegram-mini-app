"use client";

import { usePathname } from 'next/navigation';
import MobileLayout from '@/components/layout/MobileLayout';

const authRoutes = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-otp'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = authRoutes.some((route) => pathname?.startsWith(route));

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return <MobileLayout>{children}</MobileLayout>;
}