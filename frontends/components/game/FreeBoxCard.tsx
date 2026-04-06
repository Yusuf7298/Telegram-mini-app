
import Image from "next/image";
import { useCountdown } from '@/hooks/useCountdown';


interface FreeBoxCardProps {
  targetTime?: number; // ms timestamp
  onOpen: () => void;
  loading?: boolean;
}

import { useEffect, useState } from "react";

export default function FreeBoxCard({ targetTime, onOpen, loading }: FreeBoxCardProps) {
  const cooldown = 30; // seconds (example)
  const [target, setTarget] = useState<number>(0);

  useEffect(() => {
    setTarget(Date.now() + cooldown * 1000);
  }, []);

  const { minutes, seconds, isFinished } = useCountdown(target);

  return (
    <div className="bg-gradient-to-br from-[#0B2B3C] to-[#1DE1B6] rounded-2xl p-4 flex flex-col items-center relative">
      <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/30 rounded-full px-2 py-1 text-white text-xs font-semibold">
        <Image src="/clock.svg" alt="Timer" width={16} height={16} />
        {`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
      </div>
      <div>
        <p className="text-white text-[18px] font-bold mt-2 mb-1">OPEN YOUR FREE BOX Yusuf</p>
        <p className="text-[#B6F1E1] text-[14px] mb-3">Guaranteed airtime or cash prize!</p>
      </div>
      <button
        className="border border-white rounded-lg px-8 py-2 text-white font-bold hover:bg-white hover:text-[#0B2B3C] transition disabled:opacity-60"
        onClick={onOpen}
        disabled={loading || !isFinished}
      >
        {loading ? 'Opening...' : isFinished ? 'OPEN NOW' : 'Wait...'}
      </button>
    </div>
  );
}
