import { Card } from '@/components/ui/Card';

interface TransactionItemProps {
  type: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  date: string;
}

const statusColor = {
  pending: 'text-yellow-500',
  success: 'text-green-600',
  failed: 'text-red-500',
};

export function TransactionItem({ type, amount, status, date }: TransactionItemProps) {
  return (
    <Card className="flex items-center justify-between py-3 px-2 mb-2">
      <div>
        <div className="font-semibold text-sm">{type}</div>
        <div className="text-xs text-gray-400">{date}</div>
      </div>
      <div className="flex flex-col items-end">
        <span className="font-bold text-base">₦{amount}</span>
        <span className={`text-xs ${statusColor[status]}`}>{status}</span>
      </div>
    </Card>
  );
}
