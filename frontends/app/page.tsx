"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import WinnerTicker from "@/components/game/WinnerTicker";
import { PrizeCard } from "@/components/game/PrizeCard";
import Header from "@/components/game/Header";
import PrizeCarousel from "@/components/game/PrizeCarousel";
import { Modal } from "@/components/ui/Modal";
import BonusProgress from "@/components/game/BonusProgress";
import { ReferralCard } from "@/components/referral/ReferralCard";
import BoxAnimations from "@/components/game/BoxAnimations";
import { getBoxes, BoxData } from "@/lib/boxApi";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

type PrizeItem = {
  prize: string;
  image: string;
};

function toSafeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

export default function HomePage() {
  const [prizesOpen, setPrizesOpen] = useState(false);
  const [prizeBlock, setPrizeBlock] = useState<{ open: boolean; prize: string }>({ open: false, prize: "" });
  const [prizes, setPrizes] = useState<PrizeItem[]>([]);
  const [loadingPrizes, setLoadingPrizes] = useState(true);
  const [prizesError, setPrizesError] = useState<string | null>(null);

  useEffect(() => {
    const loadPrizes = async () => {
      setLoadingPrizes(true);
      setPrizesError(null);

      try {
        const response = await getBoxes();
        const rawBoxes: BoxData[] = response.data.data;
        const mappedPrizes = rawBoxes.map((box) => ({
          prize: `₦${toSafeNumber(box.price).toLocaleString()}`,
          image: "prizes/prizes.png",
        }));

        setPrizes(mappedPrizes);
      } catch {
        setPrizes([]);
        setPrizesError("Failed to load prizes");
      } finally {
        setLoadingPrizes(false);
      }
    };

    void loadPrizes();
  }, []);

  return (
    <div>
      <Header title="Home" />
      <BoxAnimations />

      <div className="mx-4 mb-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-2xl font-bold text-white">
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
            className="rounded-full border border-white/20 bg-[#101B2A] px-6 py-2 text-base font-semibold text-white shadow-md transition hover:bg-white/10"
            onClick={() => setPrizesOpen(true)}
            disabled={loadingPrizes || prizes.length === 0}
          >
            View All
          </button>
        </div>

        {loadingPrizes ? (
          <div className="flex items-center gap-2 rounded-2xl bg-[#101B2A] p-4 text-sm text-white/80">
            <LoadingSpinner />
            Loading prizes...
          </div>
        ) : prizesError ? (
          <div className="rounded-2xl bg-[#101B2A] p-4 text-sm text-red-300">{prizesError}</div>
        ) : prizes.length === 0 ? (
          <div className="rounded-2xl bg-[#101B2A] p-4 text-sm text-white/70">No prizes available</div>
        ) : (
          <div className="flex gap-4 overflow-x-auto rounded-2xl bg-[#101B2A] p-4">
            <PrizeCarousel prizes={prizes} />
          </div>
        )}
      </div>

      <Modal open={prizesOpen} onClose={() => setPrizesOpen(false)}>
        <div className="relative max-h-[90vh] w-full max-w-[700px] overflow-y-auto rounded-3xl bg-gradient-to-br from-[#0F2027] via-[#203A43] to-[#2C5364] p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3 text-3xl font-bold text-white">
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
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20"
              onClick={() => setPrizesOpen(false)}
              aria-label="Close"
            >
              x
            </button>
          </div>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
            {prizes.map((p, i) => (
              <div
                key={i}
                onClick={() => {
                  setPrizeBlock({ open: true, prize: p.prize });
                }}
                className="cursor-pointer rounded-2xl border-2 border-white/10 bg-black/10 p-2 transition hover:border-[#22d3aa]"
              >
                <PrizeCard prize={p.prize} image={p.image} />
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {prizeBlock.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
          <div className="w-[92vw] max-w-[420px] rounded-3xl border border-[#2c3447] bg-gradient-to-br from-[#0f2537] via-[#142c3e] to-[#1a223a] p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-bold text-white">Prize Details</div>
              <button
                className="text-2xl text-gray-400 hover:text-gray-200"
                aria-label="Close"
                onClick={() => setPrizeBlock({ open: false, prize: "" })}
              >
                x
              </button>
            </div>
            <div className="mb-4 rounded-2xl border border-[#2c3447] bg-[#15304a] p-5 text-center">
              <Image src="/images/prizes.png" alt="Prize" width={120} height={80} className="mx-auto mb-3" />
              <div className="text-sm text-white/70">Selected reward</div>
              <div className="mt-1 text-4xl font-extrabold text-white">{prizeBlock.prize}</div>
            </div>
            <button
              className="w-full rounded-xl bg-[#22d3aa] py-3 text-[14px] font-semibold text-black transition hover:bg-[#1de9b6]"
              onClick={() => setPrizeBlock({ open: false, prize: "" })}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      <div className="mx-4 mb-4">
        <BonusProgress />
      </div>

      <div className="mx-4 mb-6">
        <div className="mb-2 flex items-center gap-2 text-lg font-bold text-white">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#B97B2B] to-[#3C2A1E]">
            <Image src="/images/tropy.png" alt="trophy" width={28} height={28} className="h-7 w-7" />
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
