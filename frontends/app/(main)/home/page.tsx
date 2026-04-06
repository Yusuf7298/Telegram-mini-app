"use client";
import { useState, useEffect } from "react";
import { toast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/Skeleton';
import ApiService from '@/lib/apiService';
import { useWalletStore } from '@/store/walletStore';
import { useGameStore } from '@/store/gameStore';
import { WinModal } from '@/components/game/WinModal';
import BoxOpenAnimation from '@/components/game/BoxOpenAnimation';
import Header from "@/components/game/Header";
import FreeBoxCard from "@/components/game/FreeBoxCard";
import Image from "next/image";
import PrizeCarousel from "@/components/game/PrizeCarousel";
import WinnerTicker from "@/components/game/WinnerTicker";
import BonusProgress from "@/components/game/BonusProgress";
import { ReferralCard } from "@/components/referral/ReferralCard";
import BoxAnimations from "@/components/game/BoxAnimations";


export default function HomePage() {
  // Demo user and state
  const user = { username: "JaneDoe", avatar: "/avatar1.png" };
  const [timer, setTimer] = useState("00:30");
  const [loading, setLoading] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [pendingReward, setPendingReward] = useState<{ value: number; bigWin: boolean } | null>(null);
  const [prizeModal, setPrizeModal] = useState<{ open: boolean; amount: number }>({ open: false, amount: 0 });
  const walletStore = useWalletStore();
  const gameStore = useGameStore();

  useEffect(() => {
    let totalSeconds = 30;
    const interval = setInterval(() => {
      if (totalSeconds <= 0) return clearInterval(interval);
      totalSeconds -= 1;
      setTimer(`${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const prizes = [
    { prize: "₦1,000,000", image: "prizes/prizes.png" },
    { prize: "₦500,000", image: "prizes/prizes.png" },
    { prize: "₦200,000", image: "prizes/prizes.png" },
    { prize: "Airtime", image: "prizes/prizes.png" },
  ];
  const winners = [
    { username: "Jane", amount: "₦1,000" },
    { username: "Sam", amount: "₦500" },
    { username: "Alex", amount: "₦200" },
    { username: "Mary", amount: "₦1,000" },
    { username: "John", amount: "₦500" },
  ];

  // Box opening logic
  const handleOpenBox = async () => {
    setLoading(true);
    setShowAnimation(false);
    try {
      const { data } = await ApiService.openBox({ boxType: 'free' });
      setPendingReward({ value: data.prize.value, bigWin: data.prize.value >= 100000 });
      setShowAnimation(true);
      if (walletStore.fetchWallet) await walletStore.fetchWallet();
      if (typeof gameStore.boxesOpened === 'number') {
        gameStore.boxesOpened += 1;
      }
      if (typeof gameStore.bonusProgress === 'number') {
        gameStore.bonusProgress = (gameStore.bonusProgress || 0) + 1;
      }
      if (typeof gameStore.lastWin !== 'undefined') {
        gameStore.lastWin = data.prize;
      }
      if ((gameStore.boxesOpened || 0) >= 5) {
        // Unlock bonus logic here (e.g., show notification)
      }
      toast('Box opened! You won ₦' + data.prize.value, data.prize.value >= 100000 ? 'success' : 'info');
    } catch (e) {
      setShowAnimation(false);
      toast('Failed to open box. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Header user={user} />
      <BoxAnimations />
      <div className="mx-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 font-bold text-white text-lg">
            <span className="inline-block w-5 h-5 bg-green-400 rounded mr-1" /> PRIZES
            <button className="text-sm text-blue-500 hover:underline">View All</button>
          </div>
        </div>
        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="min-w-[120px] h-28" />
            ))}
          </div>
        ) : (
          <PrizeCarousel prizes={prizes} />
        )}
      </div>
      <div className="mx-4 mb-4">
        <BonusProgress />
      </div>
      <div className="mx-4 mb-4">
        <div className="flex items-center gap-2 font-bold text-white text-lg mb-2">
          <span className="inline-block w-5 h-5 bg-green-400 rounded mr-1" /> TOP WINNERS TODAY
        </div>
        <WinnerTicker winners={winners} />
      </div>
      <div className="mx-4 mb-4">
        <ReferralCard
          code={user.username}
          onInvite={() => toast('Invite link copied!', 'success')}
        />
      </div>

    </div>
  );
}

