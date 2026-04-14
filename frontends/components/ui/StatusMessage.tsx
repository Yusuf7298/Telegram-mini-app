import { cn } from '@/lib/utils';

type StatusMessageProps = {
  type: 'success' | 'error';
  message: string;
  className?: string;
};

export function StatusMessage({ type, message, className }: StatusMessageProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'rounded-xl border px-4 py-3 text-sm',
        type === 'success'
          ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200'
          : 'border-red-400/50 bg-red-400/10 text-red-200',
        className
      )}
    >
      {message}
    </div>
  );
}
