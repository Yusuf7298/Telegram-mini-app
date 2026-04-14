import { cn } from '@/lib/utils';

type StatusBadgeProps = {
  status: string;
};

function normalizeStatus(status: string) {
  return status.trim().toLowerCase();
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = normalizeStatus(status);

  const colorClass =
    normalized === 'active'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
      : normalized === 'frozen'
        ? 'bg-red-500/20 text-red-300 border-red-500/30'
        : normalized === 'pending'
          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
          : 'bg-slate-500/20 text-slate-300 border-slate-500/30';

  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide', colorClass)}>
      {status}
    </span>
  );
}
