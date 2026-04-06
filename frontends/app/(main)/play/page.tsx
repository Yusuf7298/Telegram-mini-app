
import MobileAppLayout from '@/components/layout/MobileLayout';
import { Header } from '@/components/layout/Header';
"use client";
import { useState } from "react";
import Image from "next/image";

const boxes = [
  {
    name: "Base Box",
    price: 100,
    image: "/box-base.png",
    win: "Win up to ₦1,000!",
  },
  {
    name: "Prime Box",
    price: 200,
    image: "/box-prime.png",
    win: "Win up to ₦5,000!",
  },
  {
    name: "Mega Box",
    price: 500,
    image: "/box-mega.png",
    win: "Win up to ₦20,000!",
  },
];

const randomPrize = (price: number) => {
  // Simulate a random win (for demo)
  const min = price;
  const max = price * 20;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export default function PlayPage() {
  const [opening, setOpening] = useState<number | null>(null);
  const [prize, setPrize] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

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
    setShowModal(false);
    setOpening(null);
    setPrize(null);
  };

  return (
    <MobileAppLayout>
      <Header title="Home" />
      <div className="flex flex-col items-center justify-center px-4 pb-20">
        <h1 className="text-2xl font-bold text-white mb-6">Open a Box</h1>
        <div className="flex flex-col gap-6 w-full max-w-xs">
        {boxes.map((box, idx) => (
          <div key={box.name} className="bg-[#101B2A] rounded-2xl p-5 flex flex-col items-center shadow-lg relative">
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
        ))}
      </div>

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
    </MobileAppLayout>
  );
}
