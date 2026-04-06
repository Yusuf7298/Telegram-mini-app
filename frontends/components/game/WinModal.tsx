import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface WinModalProps {
  open: boolean;
  amount: number;
  onOpenAnother: () => void;
  onBackHome: () => void;
}

export function WinModal({ open, amount, onOpenAnother, onBackHome }: WinModalProps) {
  return (
    <Modal open={open} onClose={onBackHome}>
      <div className="flex flex-col items-center gap-3">
        <div className="text-2xl font-bold text-green-600">CONGRATULATIONS</div>
        <div className="text-lg">You Won <span className="font-bold text-blue-700">₦{amount}</span></div>
        <div className="flex gap-2 mt-4 w-full">
          <Button className="flex-1" onClick={onOpenAnother}>Open Another Box</Button>
          <Button variant="secondary" className="flex-1" onClick={onBackHome}>Back Home</Button>
        </div>
      </div>
    </Modal>
  );
}
