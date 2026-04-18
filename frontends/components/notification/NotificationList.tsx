"use client";

import Link from 'next/link';
import { Bell, CheckCheck, Gift, MessageSquareHeart, Wallet } from 'lucide-react';

import { NotificationItem } from '@/components/notification/NotificationItem';
import { useNotificationStore } from '@/store/notificationStore';

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getIcon(kind: 'reward' | 'referral' | 'wallet' | 'system') {
  switch (kind) {
    case 'reward':
      return <Gift className="h-5 w-5" />;
    case 'referral':
      return <MessageSquareHeart className="h-5 w-5" />;
    case 'wallet':
      return <Wallet className="h-5 w-5" />;
    default:
      return <Bell className="h-5 w-5" />;
  }
}

interface NotificationListProps {
  compact?: boolean;
  onItemClick?: () => void;
}

export function NotificationList({ compact = false, onItemClick }: NotificationListProps) {
  const notifications = useNotificationStore((state) => state.notifications);
  const markNotificationRead = useNotificationStore((state) => state.markNotificationRead);
  const clearNotifications = useNotificationStore((state) => state.clearNotifications);
  const markAllNotificationsRead = useNotificationStore((state) => state.markAllNotificationsRead);

  if (notifications.length === 0) {
    return (
      <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/55">
        No notifications yet. Rewards and referral updates will appear here.
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {!compact ? (
        <div className="flex items-center justify-between gap-3">
          <div className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/40">
            Latest activity
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={markAllNotificationsRead}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-semibold text-white/75 transition hover:bg-white/10"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </button>
            <button
              type="button"
              onClick={clearNotifications}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-semibold text-white/55 transition hover:bg-white/10"
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          icon={getIcon(notification.kind)}
          tone={notification.kind}
          title={notification.title}
          message={notification.message}
          date={formatDate(notification.createdAt)}
          read={notification.read}
          onClick={() => {
            markNotificationRead(notification.id);
            onItemClick?.();
          }}
        />
      ))}

      {!compact ? (
        <Link
          href="/play"
          className="mt-2 inline-flex items-center justify-center rounded-[18px] border border-[#18e0a8]/30 bg-[#18e0a8]/10 px-4 py-3 text-sm font-semibold text-[#18e0a8] transition hover:bg-[#18e0a8]/15"
        >
          Back to play
        </Link>
      ) : null}
    </div>
  );
}
