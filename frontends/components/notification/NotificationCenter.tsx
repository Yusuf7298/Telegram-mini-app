"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { NotificationList } from '@/components/notification/NotificationList';
import { useNotificationStore } from '@/store/notificationStore';

function getUnreadCount(notifications: { read: boolean }[]) {
  return notifications.reduce((count, notification) => count + (notification.read ? 0 : 1), 0);
}

export default function NotificationCenter({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const notifications = useNotificationStore((state) => state.notifications);
  const markAllNotificationsRead = useNotificationStore((state) => state.markAllNotificationsRead);

  const unreadCount = useMemo(() => getUnreadCount(notifications), [notifications]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleToggle = () => {
    setOpen((current) => !current);
    if (!open) {
      markAllNotificationsRead();
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        aria-label="Open notifications"
        aria-expanded={open}
        onClick={handleToggle}
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#18e0a8] px-1 text-[10px] font-black text-black">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-14 z-50 w-[min(92vw,360px)] overflow-hidden rounded-[24px] border border-white/10 bg-[#091423] shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/45">Notifications</div>
              <div className="mt-1 text-[16px] font-bold text-white">Activity feed</div>
            </div>
            <Link
              href="/notifications"
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-semibold text-white/80 transition hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              View all
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="max-h-[420px] overflow-y-auto p-3">
            <NotificationList compact onItemClick={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
