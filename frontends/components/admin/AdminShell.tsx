"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAdminContext } from './AdminContext';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/store/authStore';
import { Skeleton } from '@/components/ui/Skeleton';

const navItems = [
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/rewards', label: 'Rewards' },
  { href: '/admin/transactions', label: 'Transactions' },
  { href: '/admin/config', label: 'System Config' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { adminSecret, setAdminSecret } = useAdminContext();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const isAdmin = user?.role === 'ADMIN';
    if (!isAdmin) {
      router.replace('/');
      return;
    }

    setCheckingAuth(false);
  }, [router, user]);

  const title = useMemo(() => {
    const active = navItems.find((item) => pathname?.startsWith(item.href));
    return active?.label ?? 'Admin';
  }, [pathname]);

  if (checkingAuth) {
    return (
      <div className="min-h-telegram-screen safe-screen-padding bg-[#0b1220] text-white">
        <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 md:px-6">
          <div className="rounded-2xl border border-white/10 bg-[#121b2d] p-4 space-y-3">
            <p className="text-sm text-slate-300">Checking admin access...</p>
            <Skeleton className="h-10 w-44" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-telegram-screen safe-screen-padding bg-[#0b1220] text-white">
      <div className="mx-auto flex max-w-7xl gap-4 px-3 py-4 sm:px-4 md:px-6">
        <aside className="hidden w-64 shrink-0 rounded-2xl border border-white/10 bg-[#121b2d] p-4 md:block">
          <div className="mb-4 text-lg font-bold">Admin Console</div>
          <nav className="space-y-2">
            {navItems.map((item) => {
              const active = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-sm transition ${
                    active ? 'bg-emerald-500/20 text-emerald-200' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="mb-4 rounded-2xl border border-white/10 bg-[#121b2d] p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold">{title}</h1>
                <p className="text-sm text-slate-300">Production admin operations panel</p>
              </div>
              <div className="w-full max-w-sm">
                <Input
                  type="password"
                  label="Admin Secret"
                  placeholder="Required for admin actions"
                  value={adminSecret}
                  onChange={(event) => setAdminSecret(event.target.value)}
                />
              </div>
            </div>

            <nav className="mt-3 grid grid-cols-2 gap-2 md:hidden">
              {navItems.map((item) => {
                const active = pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`min-h-[44px] rounded-lg px-3 py-2 text-sm transition flex items-center justify-center text-center ${
                      active ? 'bg-emerald-500/20 text-emerald-200' : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>

          <div className="rounded-2xl border border-white/10 bg-[#121b2d] p-4">{children}</div>
        </main>
      </div>
    </div>
  );
}
