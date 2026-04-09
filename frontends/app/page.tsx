"use client";
import { useState } from "react";
import Link from "next/link";
import WinnerTicker from "@/components/game/WinnerTicker";

import { PrizeCard } from '@/components/game/PrizeCard';
import dynamic from 'next/dynamic';
const WinPage = dynamic(() => import('./win-page'), { ssr: false });
import Header from "@/components/game/Header";
import Image from "next/image";
import PrizeCarousel from "@/components/game/PrizeCarousel";
import { Modal } from "@/components/ui/Modal";
import BonusProgress from "@/components/game/BonusProgress";
import { ReferralCard } from "@/components/referral/ReferralCard";
import BoxAnimations from "@/components/game/BoxAnimations";


export default function HomePage() {
  const [prizesOpen, setPrizesOpen] = useState(false);
  const [prizeBlock, setPrizeBlock] = useState<{ open: boolean; prize: string }>({ open: false, prize: '' });
  const prizes = [
    { prize: "₦1,000,000", image: "prizes/prizes.png" },
    { prize: "₦500,000", image: "prizes/prizes.png" },
    { prize: "₦200,000", image: "prizes/prizes.png" },
    { prize: "Airtime", image: "prizes/prizes.png" },
    { prize: "₦1,000,000", image: "prizes/prizes.png" },
    { prize: "₦500,000", image: "prizes/prizes.png" },
    { prize: "₦200,000", image: "prizes/prizes.png" },
    { prize: "Airtime", image: "prizes/prizes.png" },
    { prize: "₦1,000,000", image: "prizes/prizes.png" },
    { prize: "₦500,000", image: "prizes/prizes.png" },
    { prize: "₦200,000", image: "prizes/prizes.png" },
    { prize: "Airtime", image: "prizes/prizes.png" },
  ];
  return (
    <div>
      <Header title="Home" />
      <BoxAnimations />
      <div className="mx-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 font-bold text-white text-2xl">
            {/* Figma-style Gift Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 32 32">
              <rect x="4" y="12" width="24" height="12" rx="3" fill="#22d3aa" />
              <rect x="10" y="6" width="12" height="6" rx="3" fill="#FFD600" />
              <rect x="15" y="6" width="2" height="18" rx="1" fill="#fff" />
              <rect x="4" y="24" width="24" height="3" rx="1.5" fill="#22d3aa" />
              <rect x="4" y="12" width="24" height="3" rx="1.5" fill="#fff" />
            </svg>
            <span className="font-extrabold tracking-tight">PRIZES</span>
          </div>
          <button
            className="bg-[#101B2A] border border-white/20 rounded-full px-6 py-2 text-white text-base font-semibold shadow-md hover:bg-white/10 transition"
            onClick={() => setPrizesOpen(true)}
          >
            View All
          </button>
        </div>
        <div className="bg-[#101B2A] rounded-2xl p-4 flex gap-4 overflow-x-auto">
          <PrizeCarousel prizes={prizes} />
        </div>
      </div>
      <Modal open={prizesOpen} onClose={() => setPrizesOpen(false)}>
        <div className="w-full max-w-[700px] max-h-[90vh] overflow-y-auto bg-gradient-to-br from-[#0F2027] via-[#203A43] to-[#2C5364] rounded-3xl p-6 relative">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3 font-bold text-white text-3xl">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 32 32">
                <rect x="4" y="12" width="24" height="12" rx="3" fill="#22d3aa" />
                <rect x="10" y="6" width="12" height="6" rx="3" fill="#FFD600" />
                <rect x="15" y="6" width="2" height="18" rx="1" fill="#fff" />
                <rect x="4" y="24" width="24" height="3" rx="1.5" fill="#22d3aa" />
                <rect x="4" y="12" width="24" height="3" rx="1.5" fill="#fff" />
              </svg>
              <span className="font-extrabold tracking-tight">PRIZES</span>
            </div>
            <button
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-2xl text-white transition"
              onClick={() => setPrizesOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {prizes.map((p, i) => (
              <div
                key={i}
                onClick={() => { setPrizeBlock({ open: true, prize: p.prize }); }}
                className="cursor-pointer border-2 border-white/10 rounded-2xl p-2 bg-black/10 hover:border-[#22d3aa] transition"
              >
                <PrizeCard prize={p.prize} image={p.image} />
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Prize Block Modal */}
      {prizeBlock.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
          <div className="rounded-3xl border border-[#2c3447] w-[92vw] max-w-[420px] sm:max-w-[420px] p-0 shadow-none relative bg-gradient-to-br from-[#0f2537] via-[#142c3e] to-[#1a223a]">
            <div className="flex items-center justify-between px-6 pt-6 pb-2">
              <div className="flex items-center gap-2 font-bold text-lg text-white">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-6 h-6">
                  <rect x="3" y="8" width="18" height="10" rx="2" fill="#22d3aa" />
                  <rect x="7" y="4" width="10" height="4" rx="2" fill="#FFD600" />
                  <rect x="11" y="4" width="2" height="14" rx="1" fill="#fff" />
                  <rect x="3" y="18" width="18" height="2" rx="1" fill="#22d3aa" />
                  <rect x="3" y="8" width="18" height="2" rx="1" fill="#fff" />
                </svg>
                <span>PRIZES</span>
              </div>
              <button className="text-gray-400 hover:text-gray-700 text-2xl" aria-label="Close" onClick={() => setPrizeBlock({ open: false, prize: '' })}>
                ×
              </button>
            </div>
            <div className="px-6 pt-2 pb-6">
              <div className="rounded-2xl bg-gradient-to-br from-[#B97B2B] to-[#7C5520] border border-[#2c3447] p-6 flex flex-col items-center relative mb-6">
                <div className="text-center text-lg font-bold text-white mb-2 mt-2 tracking-wide">YOU WON</div>
                <Image src="/images/prizes.png" alt="Prize" width={120} height={80} className="mx-auto mb-2" />
                <hr className="border-t border-[#2c3447] w-full my-2 opacity-60" />
                <div className="text-center text-[14px] text-white/80">You've unlocked<br />
                  <span className="font-bold text-[48px]">{prizeBlock.prize}</span><br />
                  We’ve added it to your BoxPlay account
                </div>
              </div>
              <div className="bg-[#16263a] rounded-2xl p-4 mb-4">
                <div className="text-white font-bold text-[18px] mb-2">UNLOCK YOUR {prizeBlock.prize} BONUS</div>
                {(() => {
                  // Dynamic progress bar logic
                  const [boxesOpened, totalBoxes] = [2, 5]; // Replace with state if needed
                  const percent = Math.round((boxesOpened / totalBoxes) * 100);
                  return (
                    <>
                      <div className="w-full h-3 bg-[#101B2A] rounded-full mb-2 overflow-hidden">
                        <div className="h-full bg-[#22d3aa] rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
                      </div>
                      <div className="flex justify-between text-white/80 text-[14px] mb-2">
                        <span>Boxes Opened</span>
                        <span>{boxesOpened}/{totalBoxes}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
              <button
                className="w-full py-3 rounded-xl bg-[#22d3aa] text-black font-semibold font-Rubik text-[14px] mt-2 hover:bg-[#1de9b6] transition"
                onClick={() => setPrizeBlock({ open: false, prize: '' })}
              >
                OPEN ANOTHER BOX
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Win Modal removed: handled by prizeBlock modal above */}
      <div className="mx-4 mb-4">
        <BonusProgress />
      </div>
      <div className="mx-4 mb-6">
        <div className="flex items-center gap-2 font-bold text-white text-lg mb-2">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-[#B97B2B] to-[#3C2A1E]">
            <Image src="/images/tropy.png" alt="trophy" width={28} height={28} className="w-7 h-7" />
          </span>
          TOP WINNERS TODAY
        </div>
        <WinnerTicker />
      </div>
      <div className="mx-4 mb-6">
        <ReferralCard />
      </div>

    </div>
  );
}

