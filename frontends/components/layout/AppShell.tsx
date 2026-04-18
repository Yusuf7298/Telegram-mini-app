"use client";

import { usePathname } from 'next/navigation';
import MobileLayout from '@/components/layout/MobileLayout';
import TelegramAuthBootstrap from '@/components/auth/TelegramAuthBootstrap';
import { FeedbackFX } from '@/components/game/FeedbackFX';

const authRoutes = ['/login', '/signup'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = authRoutes.some((route) => pathname?.startsWith(route));
  const isAdminRoute = pathname?.startsWith('/admin');

  return (
    <TelegramAuthBootstrap>
      <FeedbackFX />
      {isAuthRoute || isAdminRoute ? <>{children}</> : <MobileLayout>{children}</MobileLayout>}
    </TelegramAuthBootstrap>
  );
}