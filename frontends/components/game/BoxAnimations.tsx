import Image from "next/image";
import { useState } from "react";
import dynamic from "next/dynamic";

const WinPage = dynamic(() => import("@/app/win-page"), { ssr: false });

export default function BoxAnimations() {
  const [showWin, setShowWin] = useState(false);
  return (
    <>
      <div className="relative w-[350px] h-[301px] mb-4 rounded-xl overflow-hidden shadow-lg bg-gradient-to-br from-[#0f2c3f] to-[#1e5a3a] p-0 mx-auto">
        {/* Background */}
        <Image
          src="/images/background.png"
          alt="Background"
          fill
          sizes="(max-width: 350px) 100vw, 350px"
          style={{ objectFit: "cover" }}
          className="absolute inset-0 z-0"
          priority
        />

        {/* Coins and Box */}
        <div className="absolute left-1/2 top-[60px] -translate-x-1/2 z-10 flex flex-col items-center">
          <Image
            src="/images/coin.png"
            alt="Coins"
            width={160}
            height={100}
            style={{ height: 'auto' }}
            className="drop-shadow-lg"
            priority
          />
        </div>

        {/* Overlay content */}
        <div className="absolute bottom-0 left-0 w-full p-4 z-20 flex flex-col items-center">
          <div className="text-white font-bold text-[18px] mb-1 text-center">OPEN YOUR FREE BOX</div>
          <div className="text-white text-[14px] mb-3 text-center opacity-80">Guaranteed airtime or cash prize!</div>
          <button
            className="w-full border border-white rounded-lg px-8 py-2 text-white font-bold hover:bg-white hover:text-[#1e5a3a] transition mb-2"
            onClick={() => setShowWin(true)}
          >
            OPEN NOW
          </button>
        </div>

        {/* Timer (top right) */}
        <div className="absolute top-2 right-2 bg-black bg-opacity-40 rounded-full px-3 py-1 text-xs text-white font-semibold z-30">
          0:23
        </div>
      </div>
      {showWin && (
        <WinPage prize="₦1,000" onUnlock={() => setShowWin(false)} />
      )}
    </>
  );
}