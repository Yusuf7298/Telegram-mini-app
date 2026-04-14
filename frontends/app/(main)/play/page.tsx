"use client";
import { ArrowLeft, BellIcon, Trophy, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { ReferralCard } from "@/components/referral/ReferralCard";
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/ToastProvider';
import { BoxData, getBoxes, openBox, OpenBoxPayload } from "@/lib/boxApi";
import { useWalletStore } from "@/store/walletStore";

const topWinners = [
  { name: 'AJ', amount: '₦10,000', tone: 'from-[#ffb347] to-[#ff7a18]' },
  { name: 'LK', amount: '₦10,000', tone: 'from-[#f9d423] to-[#f83600]' },
  { name: 'MN', amount: '₦10,000', tone: 'from-[#ffd166] to-[#f77f00]' },
  { name: 'BT', amount: '₦1,000', tone: 'from-[#5bc0be] to-[#1c7c54]' },
  { name: 'OX', amount: '₦1,000', tone: 'from-[#ff7b7b] to-[#c44569]' },
  { name: 'SM', amount: '₦1,000', tone: 'from-[#7f8cff] to-[#3f51b5]', muted: true },
];

type PlayBox = {
  id: string;
  name: string;
  price: number;
  image: string;
  win: string;
};

type LastOpenAttempt = {
  boxIndex: number;
  payload: OpenBoxPayload;
};

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `open_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

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

export default function PlayPage() {
  const [boxes, setBoxes] = useState<PlayBox[]>([]);
  const [boxesLoading, setBoxesLoading] = useState(true);
  const [opening, setOpening] = useState<number | null>(null);
  const [prize, setPrize] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [hasActionError, setHasActionError] = useState(false);
  const [retryingOpen, setRetryingOpen] = useState(false);
  const [lastOpenAttempt, setLastOpenAttempt] = useState<LastOpenAttempt | null>(null);
  const { showToast } = useToast();
  const fetchWallet = useWalletStore((state) => state.fetchWallet);
  const updateWalletFromResponse = useWalletStore((state) => state.updateWalletFromResponse);
  const cash = useWalletStore((state) => state.cashBalance);
  const bonus = useWalletStore((state) => state.bonusBalance);
  const router = useRouter();

  const totalWallet = useMemo(() => cash + bonus, [cash, bonus]);

  useEffect(() => {
    const loadData = async () => {
      setBoxesLoading(true);
      setHasActionError(false);

      try {
        const [walletResult, boxesResult] = await Promise.all([fetchWallet(), getBoxes()]);
        void walletResult;

        const rawBoxes: BoxData[] = boxesResult.data.data;

        const mappedBoxes = rawBoxes.map((box, idx) => ({
          id: box.id,
          name: box.name,
          price: toSafeNumber(box.price),
          image: idx % 2 === 0 ? "/Boxes/box2.png" : "/Boxes/box3.png",
          win: `Win up to ₦${(toSafeNumber(box.price) * 10).toLocaleString()}!`,
        }));

        setBoxes(mappedBoxes);
      } catch {
        // API interceptor handles global error toast.
      } finally {
        setBoxesLoading(false);
      }
    };

    void loadData();
  }, [fetchWallet]);


  const handleClick = () => {
    router.back();
  };

  const executeOpenBox = async (attempt: LastOpenAttempt, isRetry = false) => {
    if (opening !== null) {
      return;
    }

    setOpening(attempt.boxIndex);
    setRetryingOpen(isRetry);
    setHasActionError(false);
    setOpenError(null);
    setPrize(null);

    try {
      const response = await openBox(attempt.payload);
      const payload = response.data.data;
      const reward = toSafeNumber(payload.reward);
      setPrize(reward);
      showToast({ type: 'success', message: `Reward won: ₦${reward.toLocaleString()}` });
      setShowModal(true);
      const updated = updateWalletFromResponse(payload);
      if (!updated) {
        await fetchWallet();
      }
    } catch (requestError) {
      const message =
        typeof requestError === 'object' && requestError !== null && 'message' in requestError
          ? String((requestError as { message?: unknown }).message ?? 'Request failed. Please try again.')
          : 'Request failed. Please try again.';
      setOpenError(message);
      setHasActionError(true);
    } finally {
      setOpening(null);
      setRetryingOpen(false);
    }
  };

  const handleOpen = async (idx: number, boxId: string) => {
    if (opening !== null) {
      return;
    }

    const payload: OpenBoxPayload = {
      boxId,
      idempotencyKey: createIdempotencyKey(),
      timestamp: Date.now(),
    };

    const attempt: LastOpenAttempt = { boxIndex: idx, payload };
    setLastOpenAttempt(attempt);
    await executeOpenBox(attempt);
  };

  const handleRetryLastOpen = async () => {
    if (!lastOpenAttempt || opening !== null) {
      return;
    }

    await executeOpenBox(lastOpenAttempt, true);
  };

  const handleOpenAnother = () => {
    setOpening(null);
    setPrize(null);
    setShowModal(false);
  };

  return (
    <div className="min-h-telegram-screen safe-screen-padding overflow-x-hidden bg-gradient-to-b from-[#0A1837] to-[#1B2B4C] p-0">
      <div className="mx-auto w-full max-w-md px-3 py-4 sm:px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={handleClick} aria-label="Go back" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
            <ArrowLeft className="text-white" size={20} />
          </button>
          <div className="flex items-center gap-2 text-white font-bold font-Poppins text-[14px]">
            ₦{totalWallet.toLocaleString()}
            <Wallet size={17} className="text-[#03DD8D]" />
          </div>
          <div className="flex items-center gap-2">
            <button aria-label="Notifications" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
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
          <button
            className="mt-2 mb-3 min-h-[44px] w-full cursor-pointer rounded-lg border border-white/60 bg-transparent px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-60"
            disabled={boxesLoading || opening !== null || boxes.length === 0}
            onClick={() => {
              if (boxes[0]) {
                void handleOpen(0, boxes[0].id);
              }
            }}
          >
            {opening === 0 ? "Processing..." : `OPEN BOX - ₦${boxes[0]?.price ?? 0}`}
          </button>
          <div className="flex items-center gap-2 text-white/80 text-[12px] font-Poppins mt-2">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="2"/><path d="M12 8v4l3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="font-bold">POPULAR!</span> Opened 127 times today
          </div>
        </div>

        {hasActionError && (
          <div className="mb-4">
            {openError ? <p className="text-sm text-red-300">{openError}</p> : null}
            {lastOpenAttempt && (
              <button
                className="mt-2 min-h-[44px] rounded-md bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                onClick={() => {
                  void handleRetryLastOpen();
                }}
                disabled={opening !== null}
              >
                {retryingOpen ? 'Retrying...' : 'Retry'}
              </button>
            )}
          </div>
        )}

        {opening !== null && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            <LoadingSpinner />
            Processing request...
          </div>
        )}

        {/* Box Cards */}
        <div className="grid grid-cols-1 gap-5">
          {boxesLoading && (
            <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 p-4 text-sm text-white/80">
              <LoadingSpinner />
              Loading boxes...
            </div>
          )}

          {boxes.map((box, idx) => {
            if (idx === 0) {
              return (
                <div
                  key={box.id}
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
                        className="mb-3 min-h-[44px] w-full cursor-pointer rounded-lg border-2 border-white/80 bg-transparent px-4 py-3 font-Rubik text-sm font-semibold tracking-wider text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                        style={{ letterSpacing: '0.04em' }}
                        disabled={opening !== null || boxesLoading}
                        onClick={() => {
                          void handleOpen(idx, box.id);
                        }}
                      >
                        {opening === idx ? 'Processing...' : `OPEN BOX - ₦${box.price}`}
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
                  key={box.id}
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
                        className="mb-3 min-h-[44px] w-full cursor-pointer rounded-lg border-2 border-white/80 bg-transparent px-4 py-3 font-Rubik text-sm font-semibold tracking-wider text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                        style={{ letterSpacing: '0.04em' }}
                        disabled={opening !== null || boxesLoading}
                        onClick={() => {
                          void handleOpen(idx, box.id);
                        }}
                      >
                        {opening === idx ? 'Processing...' : `OPEN BOX - ₦${box.price}`}
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
                key={box.id}
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
                    className="mt-2 min-h-[44px] w-full rounded-lg bg-gradient-to-r from-blue-600 to-green-500 px-4 py-2 text-base font-bold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={opening !== null || boxesLoading}
                    onClick={() => {
                      void handleOpen(idx, box.id);
                    }}
                  >
                    {opening === idx ? 'Processing...' : 'Open Box'}
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
            <span className="font-bold text-lg sm:text-[20px] font-Rubik tracking-[-0.03em]">TOP WINNERS TODAY</span>
          </div>

          <div className="grid grid-cols-3 gap-3 pb-2 sm:grid-cols-6">
            {topWinners.map((winner, idx) => (
              <div key={`${winner.name}-${idx}`} className="flex min-w-0 flex-col items-center">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="max-h-[85dvh] w-[min(22rem,92vw)] overflow-y-auto rounded-2xl bg-[#101B2A] p-6 sm:p-8 flex flex-col items-center shadow-xl">
              <Image src="/trophy.png" alt="Trophy" width={60} height={60} className="mb-3" />
              <div className="mb-2 text-center text-xl font-bold text-green-400 sm:text-2xl">Congratulations!</div>
              <div className="mb-4 text-center text-base text-white sm:text-lg">You won <span className="font-bold text-yellow-300">₦{prize}</span></div>
              <button
                className="mt-2 min-h-[44px] w-full rounded-lg bg-gradient-to-r from-blue-600 to-green-500 px-4 py-3 text-base font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
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
