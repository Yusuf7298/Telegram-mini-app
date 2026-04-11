"use client";

import { usePathname } from 'next/navigation';
import MobileLayout from '@/components/layout/MobileLayout';
import TelegramAuthBootstrap from '@/components/auth/TelegramAuthBootstrap';

const authRoutes = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-otp'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = authRoutes.some((route) => pathname?.startsWith(route));

  return (
    <TelegramAuthBootstrap>
      {isAuthRoute ? <>{children}</> : <MobileLayout>{children}</MobileLayout>}
    </TelegramAuthBootstrap>
  );
}