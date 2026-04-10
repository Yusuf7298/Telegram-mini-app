"use client";
import { ArrowLeft, BellIcon, Trophy, Wallet } from "lucide-react";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { ReferralCard } from "@/components/referral/ReferralCard";

const topWinners = [
  { name: 'AJ', amount: '₦10,000', tone: 'from-[#ffb347] to-[#ff7a18]' },
  { name: 'LK', amount: '₦10,000', tone: 'from-[#f9d423] to-[#f83600]' },
  { name: 'MN', amount: '₦10,000', tone: 'from-[#ffd166] to-[#f77f00]' },
  { name: 'BT', amount: '₦1,000', tone: 'from-[#5bc0be] to-[#1c7c54]' },
  { name: 'OX', amount: '₦1,000', tone: 'from-[#ff7b7b] to-[#c44569]' },
  { name: 'SM', amount: '₦1,000', tone: 'from-[#7f8cff] to-[#3f51b5]', muted: true },
];
const boxes = [
  {
    name: "Prime Box",
    price: 200,
    image: "/Boxes/box2.png",
    win: "Win up to ₦5,000!",
  },
  {
    name: "Mega Box",
    price: 500,
    image: "/Boxes/box3.png",
    win: "Win up to ₦20,000!",
  },
];

function randomPrize(price: number) {
  // Mock random prize logic
  const min = Math.floor(price * 0.5);
  const max = price * 10;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function PlayPage() {
  const [opening, setOpening] = useState<number | null>(null);
  const [prize, setPrize] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();


  const handleClick = () => {
    router.back();
  };

  const handleOpen = (idx: number, price: number) => {
    setOpening(idx);
    setPrize(null);
    setTimeout(() => {
      const win = randomPrize(price);
      setPrize(win);
      setTimeout(() => {
        setShowModal(true);
      }, 900);
    }, 1200);
  };

  const handleOpenAnother = () => {
    setOpening(null);
    setPrize(null);
    setShowModal(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A1837] to-[#1B2B4C] p-0">
      <div className="max-w-md mx-auto py-4 px-2">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={handleClick} className="p-2 rounded-full bg-white/10 hover:bg-white/20">
            <ArrowLeft className="text-white" size={20} />
          </button>
          <div className="flex items-center gap-2 text-white font-bold font-Poppins text-[14px]">
            N1,000
            <Wallet size={17} className="text-[#03DD8D]" />
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-full bg-white/10 hover:bg-white/20">
              <BellIcon className="text-white" size={20} />
            </button>
          </div>
        </div>

        {/* Featured Booster Box */}
        <div className="p-5 flex flex-col items-start w-full mb-6 rounded-2xl bg-gradient-to-r from-yellow-400/30 to-pink-500/20 border border-white/10 shadow-lg">
          <div className="flex w-full justify-between items-start mb-2">
            <div className="flex items-center">
              <span className="flex items-center px-3 py-1 rounded-full border border-white/40 text-white text-[12px] font-Poppins mr-2">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" className="mr-1">
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 8v4l3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Most Popular
              </span>
            </div>
            <div className="flex items-center bg-transparent rounded-lg px-3 py-1">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" className="mr-1"><circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="2"/><path d="M8 12h8M12 8v8" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
              <span className="text-white text-[12px] font-Poppins">₦5,000,000</span>
            </div>
          </div>
          <div className="flex w-full justify-center mb-2">
            <img src="/Boxes/box1.png" alt="Booster Box" className="w-28 h-24 object-contain" />
          </div>
          <div className="text-white font-bold text-[16px] font-Rubik mb-1">BOOSTER BOX</div>
          <div className="text-white/80 text-[12px] font-Poppins mb-4">Unlock rewards faster & win big airtime & cash prizes!</div>
          <button className="w-full py-3 rounded-lg border border-white/60 text-white font-semibold text-[14px] cursor-pointer mt-2 bg-transparent hover:bg-white/10 transition mb-3">OPEN BOX - ₦250</button>
          <div className="flex items-center gap-2 text-white/80 text-[12px] font-Poppins mt-2">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="2"/><path d="M12 8v4l3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="font-bold">POPULAR!</span> Opened 127 times today
          </div>
        </div>

        {/* Box Cards */}
        <div className="grid grid-cols-1 gap-5">
          {boxes.map((box, idx) => {
            if (idx === 0) {
              return (
                <div
                  key={box.name}
                  className="relative rounded-2xl p-0 shadow-lg border border-[#fff2]/30 bg-gradient-to-br from-[#A32B5B] to-[#3B1B3F]"
                  style={{ boxShadow: '0 2px 16px 0 rgba(163,43,91,0.18)' }}
                >
                  <div className="flex flex-col items-start w-full">
                    <div className="w-full flex justify-between items-start px-6 pt-6">
                      <div></div>
                      <div className="flex items-center gap-1 bg-white/10 rounded-full px-3 py-1">
                        <span className="text-white/80 text-[12px] font-Poppins flex items-center gap-1">
                          <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="2" />
                            <text x="7" y="17" fontSize="12" fill="#fff">₦</text>
                          </svg>
                          ₦5,000,000
                        </span>
                      </div>
                    </div>
                    <div className="w-full flex justify-center items-center pt-2 pb-3">
                      <Image src={box.image} alt={box.name} width={120} height={90} className="object-contain" />
                    </div>
                    <div className="px-6 pb-2 w-full">
                      <div className="text-white font-extrabold text-[16px] font-Rubik mb-1">BIG CASH BOX</div>
                      <div className="text-white/80 text-[12px] font-Poppins mb-5">Great value & odds of winning 100’s of prizes!</div>
                      <button
                        className="w-full py-3 rounded-lg border-2 border-white/80 text-white font-semibold cursor-pointer font-Rubik text-[14px] bg-transparent hover:bg-white/10 transition mb-3 tracking-wider"
                        style={{ letterSpacing: '0.04em' }}
                        disabled={opening !== null}
                        onClick={() => handleOpen(idx, box.price)}
                      >
                        OPEN BOX - ₦{box.price}
                      </button>
                    </div>
                    {/* Prize Reveal Animation */}
                    {opening === idx && prize !== null && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-2xl animate-fade-in">
                        <span className="text-yellow-300 text-2xl font-bold mb-2 animate-bounce">₦{prize}</span>
                        <span className="text-white text-sm">You won!</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            // Custom style for the second box (Mega)
            if (idx === 1) {
              return (
                <div
                  key={box.name}
                  className="relative rounded-2xl p-0 shadow-lg border border-[#fff2]/30 bg-gradient-to-br from-[#B97B2E] to-[#6B4A1B]"
                  style={{ boxShadow: '0 2px 16px 0 rgba(185,123,46,0.18)' }}
                >
                  <div className="flex flex-col items-start w-full">
                    <div className="w-full flex justify-between items-start px-6 pt-6">
                      <div></div>
                      <div className="flex items-center gap-1 bg-white/10 rounded-full px-3 py-1">
                        <span className="text-white/80 text-[12px] font-Poppins flex items-center gap-1">
                          <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="2" />
                            <text x="7" y="17" fontSize="12" fill="#fff">₦</text>
                          </svg>
                          ₦5,000,000
                        </span>
                      </div>
                    </div>
                    <div className="w-full flex justify-center items-center pt-2 pb-3">
                      <Image src={box.image} alt={box.name} width={120} height={90} className="object-contain" />
                    </div>
                    <div className="px-6 pb-2 w-full">
                      <div className="text-white font-bold text-[16px] font-Rubik mb-1">MEGA BOX</div>
                      <div className="text-white/80 text-[12px] font-Poppins mb-5">Go bigger with massive cash prizes to be won!</div>
                      <button
                        className="w-full py-3 rounded-lg border-2 border-white/80 text-white font-semibold cursor-pointer font-Rubik text-[14px] bg-transparent hover:bg-white/10 transition mb-3 tracking-wider"
                        style={{ letterSpacing: '0.04em' }}
                        disabled={opening !== null}
                        onClick={() => handleOpen(idx, box.price)}
                      >
                        OPEN BOX - ₦{box.price}
                      </button>
                    </div>
                    {/* Prize Reveal Animation */}
                    {opening === idx && prize !== null && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-2xl animate-fade-in">
                        <span className="text-yellow-300 text-2xl font-bold mb-2 animate-bounce">₦{prize}</span>
                        <span className="text-white text-sm">You won!</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            // Default style for other boxes
            return (
              <div
                key={box.name}
                className="relative bg-gradient-to-br from-blue-900/60 to-green-800/40 rounded-2xl p-5 shadow-lg border border-white/10"
              >
                <div className="flex flex-col items-center">
                  <div className="mb-2">
                    <Image
                      src={box.image}
                      alt={box.name}
                      width={90}
                      height={90}
                      className={`transition-transform duration-700 ${opening === idx ? 'animate-bounce scale-110' : ''}`}
                    />
                  </div>
                  <div className="text-white font-bold text-lg mb-1">{box.name}</div>
                  <div className="text-green-400 font-bold text-xl mb-1">₦{box.price}</div>
                  <div className="text-gray-300 text-sm mb-3">{box.win}</div>
                  <button
                    className="w-full py-2 rounded-lg bg-gradient-to-r from-blue-600 to-green-500 text-white font-bold text-lg mt-2 disabled:opacity-60 disabled:cursor-not-allowed transition"
                    disabled={opening !== null}
                    onClick={() => handleOpen(idx, box.price)}
                  >
                    {opening === idx ? 'Opening...' : 'Open Box'}
                  </button>
                  {/* Prize Reveal Animation */}
                  {opening === idx && prize !== null && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-2xl animate-fade-in">
                      <span className="text-yellow-300 text-2xl font-bold mb-2 animate-bounce">₦{prize}</span>
                      <span className="text-white text-sm">You won!</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Top Winners Today */}
        <div className="mt-6 mb-6">
          <div className="mb-4 flex items-center gap-2 text-white">
            <Trophy className="h-7 w-7 text-[#1DE1B6]" fill="currentColor" />
            <span className="font-bold text-[20px] font-Rubik tracking-[-0.03em]">TOP WINNERS TODAY</span>
          </div>

          <div className="flex gap-5 overflow-x-auto pb-2 pr-2">
            {topWinners.map((winner, idx) => (
              <div key={`${winner.name}-${idx}`} className="flex min-w-[72px] flex-col items-center">
                <div className={`h-14 w-14 rounded-full bg-gradient-to-br ${winner.tone} p-[3px] shadow-[0_8px_24px_rgba(0,0,0,0.35)] ${winner.muted ? 'opacity-30' : ''}`}>
                  <div className="grid h-full w-full place-items-center rounded-full bg-[#09111f] text-[18px] font-black text-white">
                    {winner.name}
                  </div>
                </div>
                <div className={`mt-2 text-center text-[12px] font-Poppins text-white ${winner.muted ? 'opacity-40' : ''}`}>
                  {winner.amount}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invite Friends */}
        <ReferralCard />

        {/* Win Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="bg-[#101B2A] rounded-2xl p-8 flex flex-col items-center shadow-xl w-80">
              <Image src="/trophy.png" alt="Trophy" width={60} height={60} className="mb-3" />
              <div className="text-green-400 text-2xl font-bold mb-2">Congratulations!</div>
              <div className="text-white text-lg mb-4">You won <span className="text-yellow-300 font-bold">₦{prize}</span></div>
              <button
                className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-green-500 text-white font-bold text-lg mt-2"
                onClick={handleOpenAnother}
              >
                Open Another Box
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
