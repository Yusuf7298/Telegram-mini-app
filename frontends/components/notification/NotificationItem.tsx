import { ReactNode } from 'react';

interface NotificationItemProps {
  icon: ReactNode;
  message: string;
  date: string;
}

export function NotificationItem({ icon, message, date }: NotificationItemProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white shadow mb-2">
      <div className="w-10 h-10 flex items-center justify-center bg-blue-50 rounded-full">
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium">{message}</div>
        <div className="text-xs text-gray-400">{date}</div>
      </div>
    </div>
  );
}
