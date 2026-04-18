import { ReactNode } from 'react';

type NotificationTone = 'reward' | 'referral' | 'wallet' | 'system';

interface NotificationItemProps {
  icon: ReactNode;
  tone: NotificationTone;
  title: string;
  message: string;
  date: string;
  read?: boolean;
  onClick?: () => void;
}

const toneStyles: Record<NotificationTone, string> = {
  reward: 'bg-emerald-400/15 text-emerald-300',
  referral: 'bg-sky-400/15 text-sky-300',
  wallet: 'bg-amber-400/15 text-amber-300',
  system: 'bg-white/10 text-white/75',
};

export function NotificationItem({ icon, tone, title, message, date, read = false, onClick }: NotificationItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-[20px] border px-3 py-3 text-left transition ${read ? 'border-white/5 bg-white/[0.03]' : 'border-white/10 bg-white/[0.06]'} hover:bg-white/[0.08]`}
    >
      <div className={`mt-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-full ${toneStyles[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="truncate text-[14px] font-bold text-white">{title}</div>
          <div className="whitespace-nowrap text-[11px] text-white/40">{date}</div>
        </div>
        <div className="mt-1 line-clamp-2 text-[13px] leading-5 text-white/68">{message}</div>
      </div>
    </button>
  );
}
