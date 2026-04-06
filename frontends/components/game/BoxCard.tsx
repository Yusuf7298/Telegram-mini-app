import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface BoxCardProps {
  boxName: string;
  price: number;
  onOpen: () => void;
}

export function BoxCard({ boxName, price, onOpen }: BoxCardProps) {
  return (
    <Card className="flex flex-col items-center gap-3 p-5 rounded-2xl shadow-lg">
      <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mb-2">
        <span className="text-2xl font-bold text-blue-700">🎁</span>
      </div>
      <div className="font-semibold text-lg">{boxName}</div>
      <div className="text-blue-600 font-bold text-xl">₦{price}</div>
      <Button className="w-full mt-2" onClick={onOpen}>Open</Button>
    </Card>
  );
}
