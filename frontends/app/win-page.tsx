"use client";
import { useState } from "react";
import Image from "next/image";

export default function WinPage({ prize = "₦1,000", time = "12:23", onUnlock }: { prize?: string; time?: string; onUnlock?: () => void }) {
  // Simulate boxes opened for demo
  const [boxesOpened, setBoxesOpened] = useState(1);
  const totalBoxes = 5;
  return (
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
            <span>CONGRATULATIONS!</span>
          </div>
          <button className="text-gray-400 hover:text-gray-700 text-2xl" aria-label="Close" onClick={() => window.history.back()}>
            ×
          </button>
        </div>
        <div className="px-6 pt-2 pb-6">
          <div className="rounded-2xl bg-[#15304a] border border-[#2c3447] p-6 flex flex-col items-center relative">
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs text-white/70 bg-[#1a223a] rounded px-2 py-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm.75 12.25h-1.5v-1.5h1.5v1.5zm0-3h-1.5V7h1.5v4.25z" /></svg>
                {time}
              </span>
            </div>
            <div className="text-center text-lg font-bold text-white mb-2 mt-2 tracking-wide">YOU WON</div>
            <Image src="/images/coin.png" alt="Coin" width={120} height={80} className="mx-auto mb-2" />
            <hr className="border-t border-[#2c3447] w-full my-2 opacity-60" />
            <div className="text-center text-4xl font-extrabold text-white mb-2">{prize}</div>
          </div>
          <div className="mt-6 mb-2 text-white font-bold text-base">UNLOCK YOUR {prize} BONUS</div>
          <div className="text-white/80 text-sm mb-4">Play 5 boxes to claim & win up to ₦1,000,000!</div>
          <div className="w-full h-3 bg-[#101B2A] rounded-full mb-2 overflow-hidden">
            <div className="h-full bg-[#22d3aa] rounded-full transition-all duration-500" style={{ width: `${(boxesOpened / totalBoxes) * 100}%` }} />
          </div>
          <div className="flex justify-between text-white/80 text-xs mb-4">
            <span>Boxes Opened</span>
            <span>{boxesOpened}/{totalBoxes}</span>
          </div>
          <button
            className="w-full py-3 rounded-xl bg-[#22d3aa] text-black font-bold text-lg mt-2 hover:bg-[#1de9b6] transition"
            onClick={() => { setBoxesOpened(totalBoxes); onUnlock && onUnlock(); }}
          >
            UNLOCK REWARD
          </button>
        </div>
      </div>
    </div>
  );
}
