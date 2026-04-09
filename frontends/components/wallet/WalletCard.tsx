import { Card } from '@/components/ui/Card';

interface WalletCardProps {
  cash: number;
  bonus: number;
  airtime: number;
}

export function WalletCard({ cash, bonus, airtime }: WalletCardProps) {
  return (
    <Card className="flex flex-col gap-2 p-4 bg-gradient-to-r from-blue-100 to-blue-50">
      <div className="flex justify-between items-center">
        <span className="font-semibold text-gray-700">Cash Balance</span>
        <span className="font-bold text-blue-700 text-lg">₦{cash}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="font-semibold text-gray-700">Bonus Balance</span>
        <span className="font-bold text-green-600 text-lg">₦{bonus}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="font-semibold text-gray-700">Airtime Balance</span>
        <span className="font-bold text-yellow-600 text-lg">₦{airtime}</span>
      </div>
    </Card>
  );
}
