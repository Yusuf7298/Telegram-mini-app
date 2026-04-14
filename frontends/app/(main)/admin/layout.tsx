"use client";

import { ReactNode } from 'react';
import { AdminProvider } from '@/components/admin/AdminContext';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/Skeleton';

const AdminShell = dynamic(
  () => import('@/components/admin/AdminShell').then((mod) => mod.AdminShell),
  {
    loading: () => (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    ),
  }
);

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  );
}
