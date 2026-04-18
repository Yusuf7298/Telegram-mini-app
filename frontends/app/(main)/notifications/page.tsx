"use client";

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { NotificationList } from '@/components/notification/NotificationList';

export default function NotificationsPage() {
  const router = useRouter();

  return (
    <div className="min-h-telegram-screen safe-screen-padding overflow-x-hidden bg-gradient-to-b from-[#091423] to-[#050b14] px-4 py-6 pb-24 text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="text-[18px] font-bold tracking-[-0.03em]">Notifications</div>
          <div className="h-11 w-11" />
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#0c1727]/85 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <NotificationList />
        </div>
      </div>
    </div>
  );
}
