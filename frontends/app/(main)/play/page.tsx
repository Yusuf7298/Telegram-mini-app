"use client";
import { ArrowLeft, Trophy, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AnimatedCounter } from "@/components/game/AnimatedCounter";
import { BigWinBanner } from "@/components/game/BigWinBanner";
import { DailyRewardCard } from "@/components/game/DailyRewardCard";
import { ReferralCard } from "@/components/referral/ReferralCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/ToastProvider";
import { vibrate } from "@/lib/haptics";
import { BoxData, getBoxes, openBox, OpenBoxPayload } from "@/lib/boxApi";
import {
  claimDailyReward,
  DailyRewardStatus,
  getDailyRewardStatus,
  getWinHistory,
  WinHistoryEntry,
} from "@/lib/rewardsApi";
import { getTopWinners, TopWinner } from "@/lib/statsApi";
import { WinHistoryTimeline } from "@/components/game/WinHistoryTimeline";
import { useNotificationStore } from "@/store/notificationStore";
import { useWalletStore } from "@/store/walletStore";
import NotificationCenter from "@/components/notification/NotificationCenter";

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

function generateUUID() {
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

function getOpenRequestErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { status?: unknown; message?: unknown };

    if (candidate.status === 409) {
      return "Duplicate request";
    }

    if (candidate.status === 429) {
      return "Too fast, wait";
    }

    if (candidate.status === 500) {
      return "Try again";
    }

    if (typeof candidate.message === "string" && candidate.message.trim()) {
      return candidate.message;
    }
  }

  return "Try again";
}

function OpeningLabel() {
  return (
    <span className="inline-flex items-center gap-2">
      <LoadingSpinner className="h-4 w-4" />
      Opening...
    </span>
  );
}
const REWARD_REVEAL_MS = 650;
const ANIMATION_ANTICIPATION_MS = 420;
const ANIMATION_REVEAL_MS = 520;
const ANIMATION_MIN_TOTAL_MS = 1700;
type AnimationPhase = "idle" | "anticipation" | "spinning" | "reveal";
const TOP_WINNERS_REFRESH_MS = 45_000;
const TOP_WINNERS_LIMIT = 10;
const WIN_HISTORY_LIMIT = 25;
function getWinnerInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return "?";
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
function getRankHighlight(rank: number) {
  if (rank === 1) {
    return "from-[#FFE7A6] via-[#F7C95E] to-[#C98C25]";
  }

  if (rank === 2) {
    return "from-[#F1F4F8] via-[#CCD5E2] to-[#8893A3]";
  }

  if (rank === 3) {
    return "from-[#FFD3A8] via-[#EFA66B] to-[#BA6D37]";
  }

  return "from-[#2A3655] via-[#1A2745] to-[#111B33]";
}
function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function playSoundHook(type: "click" | "win" | "bigwin" | "daily") {
  if (typeof window === "undefined") {
    return;
  }

  // Optional sound hook for platform-level audio integration.
  window.dispatchEvent(new CustomEvent("app:sound", { detail: { type } }));
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export default function PlayPage() {
  const [boxes, setBoxes] = useState<PlayBox[]>([]);
  const [boxesLoading, setBoxesLoading] = useState(true);
  const [roundLoading, setRoundLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reward, setReward] = useState<number | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const [revealingBoxIndex, setRevealingBoxIndex] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [openedBoxesCount, setOpenedBoxesCount] = useState(0);
  const [totalRewardValue, setTotalRewardValue] = useState(0);
  const [openError, setOpenError] = useState<string | null>(null);
  const [hasActionError, setHasActionError] = useState(false);
  const [retryingOpen, setRetryingOpen] = useState(false);
  const [lastOpenAttempt, setLastOpenAttempt] = useState<LastOpenAttempt | null>(null);
  const [noBoxesAvailable, setNoBoxesAvailable] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>("idle");
  const [animatedRewardValue, setAnimatedRewardValue] = useState(0);
  const [topWinners, setTopWinners] = useState<TopWinner[]>([]);
  const [topWinnersLoading, setTopWinnersLoading] = useState(true);
  const [topWinnersError, setTopWinnersError] = useState<string | null>(null);
  const [dailyStatus, setDailyStatus] = useState<DailyRewardStatus | null>(null);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [dailyError, setDailyError] = useState<string | null>(null);
  const [dailyClaiming, setDailyClaiming] = useState(false);
  const [winHistory, setWinHistory] = useState<WinHistoryEntry[]>([]);
  const [winHistoryLoading, setWinHistoryLoading] = useState(true);
  const [bigWinThreshold, setBigWinThreshold] = useState<number | null>(null);
  const [bigWinAmount, setBigWinAmount] = useState<number | null>(null);
  const { showToast } = useToast();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const fetchWallet = useWalletStore((state) => state.fetchWallet);
  const updateWalletFromResponse = useWalletStore((state) => state.updateWalletFromResponse);
  const cash = useWalletStore((state) => state.cashBalance);
  const bonus = useWalletStore((state) => state.bonusBalance);
  const router = useRouter();
  const totalWallet = useMemo(() => cash + bonus, [cash, bonus]);
  const isAnimatingOpenSequence = loading || animationPhase !== "idle";

  useEffect(() => {
    if (!showModal || reward === null) {
      return;
    }
    let frameId: number | null = null;
    const durationMs = 1100;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / durationMs, 1);
      const eased = easeOutCubic(progress);
      setAnimatedRewardValue(Math.round(reward * eased));

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    setAnimatedRewardValue(0);
    frameId = window.requestAnimationFrame(tick);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [showModal, reward]);

  useEffect(() => {
    if (bigWinAmount === null) {
      return;
    }

    const timer = window.setTimeout(() => {
      setBigWinAmount(null);
    }, 4200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [bigWinAmount]);

  const loadDailyStatus = useCallback(async (withLoadingState = false) => {
    if (withLoadingState) {
      setDailyLoading(true);
    }

    try {
      const response = await getDailyRewardStatus();
      setDailyStatus(response.data.data);
      setDailyError(null);
    } catch {
      setDailyError("Failed to load daily reward status");
      if (withLoadingState) {
        setDailyStatus(null);
      }
    } finally {
      if (withLoadingState) {
        setDailyLoading(false);
      }
    }
  }, []);

  const loadWinHistory = useCallback(async (withLoadingState = false) => {
    if (withLoadingState) {
      setWinHistoryLoading(true);
    }

    try {
      const response = await getWinHistory(WIN_HISTORY_LIMIT);
      setWinHistory(response.data.data.timeline);
      setBigWinThreshold(response.data.data.bigWinThreshold);
    } catch {
      if (withLoadingState) {
        setWinHistory([]);
      }
      setBigWinThreshold(null);
    } finally {
      if (withLoadingState) {
        setWinHistoryLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setBoxesLoading(true);
      setHasActionError(false);
      setNoBoxesAvailable(false);

      try {
        const [walletResult, boxesResult, _dailyStatus, _history] = await Promise.all([
          fetchWallet(),
          getBoxes(),
          loadDailyStatus(true),
          loadWinHistory(true),
        ]);
        void walletResult;
        void _dailyStatus;
        void _history;

        const rawBoxes: BoxData[] = boxesResult.data.data;
        const mappedBoxes = rawBoxes.map((box, idx) => ({
          id: box.id,
          name: box.name,
          price: toSafeNumber(box.price),
          image: idx % 2 === 0 ? "/Boxes/box2.png" : "/Boxes/box3.png",
          win: "Tap to open",
        }));

        setBoxes(mappedBoxes);
        setNoBoxesAvailable(mappedBoxes.length === 0);
      } catch {
        // Global API toast handles the failure.
      } finally {
        setBoxesLoading(false);
      }
    };

    void loadData();
  }, [fetchWallet, loadDailyStatus, loadWinHistory]);

  const loadTopWinners = useCallback(async (withLoadingState = false) => {
    if (withLoadingState) {
      setTopWinnersLoading(true);
    }

    try {
      const response = await getTopWinners(TOP_WINNERS_LIMIT);
      setTopWinners(response.data.data.winners);
      setTopWinnersError(null);
    } catch {
      setTopWinnersError("Failed to load top winners");
      if (withLoadingState) {
        setTopWinners([]);
      }
    } finally {
      if (withLoadingState) {
        setTopWinnersLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadTopWinners(true);

    const intervalId = window.setInterval(() => {
      void loadTopWinners(false);
    }, TOP_WINNERS_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadTopWinners]);

  const handleClaimDailyReward = async () => {
    if (dailyClaiming) {
      return;
    }

    setDailyClaiming(true);
    try {
      playSoundHook("click");
      vibrate(20);

      const response = await claimDailyReward();
      const payload = response.data.data;

      const updated = updateWalletFromResponse(response.data);
      if (!updated) {
        await fetchWallet();
      }

      await Promise.all([loadDailyStatus(false), loadWinHistory(false)]);

      showToast({ type: "success", message: `Daily reward claimed: ₦${payload.rewardAmount.toLocaleString()}` });
      addNotification({
        kind: "reward",
        title: "Daily reward claimed",
        message: `You claimed ₦${payload.rewardAmount.toLocaleString()} on streak day ${payload.streak}.`,
      });

      playSoundHook("daily");
      vibrate([18, 35, 18]);
    } catch {
      showToast({ type: "error", message: "Daily reward unavailable" });
      vibrate([10, 40, 10]);
    } finally {
      setDailyClaiming(false);
    }
  };

  const reloadAvailableBoxes = async () => {
    setRoundLoading(true);
    setHasActionError(false);
    setOpenError(null);

    try {
      const boxesResult = await getBoxes();
      const rawBoxes: BoxData[] = boxesResult.data.data;
      const mappedBoxes = rawBoxes.map((box, idx) => ({
        id: box.id,
        name: box.name,
        price: toSafeNumber(box.price),
        image: idx % 2 === 0 ? "/Boxes/box2.png" : "/Boxes/box3.png",
        win: "Tap to open",
      }));

      setBoxes(mappedBoxes);
      setNoBoxesAvailable(mappedBoxes.length === 0);
      return mappedBoxes.length > 0;
    } catch {
      showToast({ type: "error", message: "Try again" });
      return false;
    } finally {
      setRoundLoading(false);
    }
  };

  const handleClick = () => {
    router.back();
  };

  const executeOpenBox = async (attempt: LastOpenAttempt, isRetry = false) => {
    if (isAnimatingOpenSequence) {
      return;
    }

    setLoading(true);
    setOpening(attempt.boxIndex);
    setAnimationPhase("anticipation");
    setRetryingOpen(isRetry);
    setHasActionError(false);
    setOpenError(null);
    setReward(null);
    setAnimatedRewardValue(0);

    playSoundHook("click");
    vibrate(12);

    const sequenceStart = Date.now();
    let openSucceeded = false;
    const spinTimer = window.setTimeout(() => {
      setAnimationPhase("spinning");
    }, ANIMATION_ANTICIPATION_MS);

    try {
      const response = await openBox(attempt.payload);
      const payload = response.data.data;
      const nextReward = toSafeNumber(payload.reward);
      const referralActivation = payload.referralActivation;

      const elapsedMs = Date.now() - sequenceStart;
      const remainingMs = Math.max(0, ANIMATION_MIN_TOTAL_MS - elapsedMs);
      if (remainingMs > 0) {
        await wait(remainingMs);
      }

      setReward(nextReward);
      setOpenedBoxesCount((current) => current + 1);
      setTotalRewardValue((current) => current + nextReward);
      setAnimationPhase("reveal");
      setRevealingBoxIndex(attempt.boxIndex);
      playSoundHook("win");
      vibrate([14, 28, 14]);
      showToast({ type: "success", message: `You won ${nextReward.toLocaleString()} coins` });
      addNotification({
        kind: 'reward',
        title: 'Reward received',
        message: `You won ₦${nextReward.toLocaleString()} from your box opening.`,
      });

      if (referralActivation) {
        const activationAmount = toSafeNumber(referralActivation.rewardAmount);
        addNotification({
          kind: 'referral',
          title: 'Referral activated',
          message: `Your referral is now active. You earned ₦${activationAmount.toLocaleString()}`,
        });
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('referrals:refresh'));
      }

      const updated = updateWalletFromResponse(response.data);
      if (!updated) {
        await fetchWallet();
      }

      await Promise.all([loadWinHistory(false), loadDailyStatus(false)]);

      if (typeof bigWinThreshold === "number" && nextReward >= bigWinThreshold) {
        setBigWinAmount(nextReward);
        playSoundHook("bigwin");
        vibrate([35, 65, 35, 65, 35]);
      }

      await wait(Math.max(ANIMATION_REVEAL_MS, REWARD_REVEAL_MS));
      setShowModal(true);
      openSucceeded = true;
    } catch (requestError) {
      const message = getOpenRequestErrorMessage(requestError);
      setOpenError(message);
      setHasActionError(true);
      showToast({ type: "error", message });
      vibrate([10, 45, 10]);
      setAnimationPhase("idle");
      setRevealingBoxIndex(null);
    } finally {
      window.clearTimeout(spinTimer);
      setLoading(false);
      setOpening(null);
      setAnimationPhase("idle");
      if (!openSucceeded) {
        setRevealingBoxIndex(null);
      }
      setRetryingOpen(false);
    }
  };

  const handleOpen = async (boxIndex: number, boxId: string) => {
    if (isAnimatingOpenSequence) {
      return;
    }

    const attempt: LastOpenAttempt = {
      boxIndex,
      payload: {
        boxId,
        idempotencyKey: generateUUID(),
        timestamp: Date.now(),
      },
    };

    setLastOpenAttempt(attempt);
    await executeOpenBox(attempt);
  };

  const handleRetryLastOpen = async () => {
    if (!lastOpenAttempt || isAnimatingOpenSequence) {
      return;
    }

    await executeOpenBox(lastOpenAttempt, true);
  };

  const handleOpenAnother = () => {
    setOpening(null);
    setReward(null);
    setAnimatedRewardValue(0);
    setShowModal(false);
    setRevealingBoxIndex(null);
    setAnimationPhase("idle");
  };

  const handleContinue = async () => {
    handleOpenAnother();

    const available = await reloadAvailableBoxes();
    if (!available) {
      setNoBoxesAvailable(true);
      showToast({ type: "info", message: "No boxes available" });
    }
  };

  return (
    <div className="min-h-telegram-screen safe-screen-padding overflow-x-hidden bg-gradient-to-b from-[#0A1837] to-[#1B2B4C] p-0">
      <BigWinBanner amount={bigWinAmount} />
      <div className="mx-auto w-full max-w-md px-3 py-4 sm:px-4">
        <div className="flex items-center justify-between mb-6">
          <button onClick={handleClick} aria-label="Go back" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
            <ArrowLeft className="text-white" size={20} />
          </button>
          <div className="flex items-center gap-2 text-white font-bold font-Poppins text-[14px]">
            ₦<AnimatedCounter value={totalWallet} />
            <Wallet size={17} className="text-[#03DD8D]" />
          </div>
          <div className="flex items-center gap-2">
            <NotificationCenter />
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-white/60">You opened</div>
            <div className="mt-1 text-xl font-extrabold text-white"><AnimatedCounter value={openedBoxesCount} /> boxes</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-white/60">Total earned</div>
            <div className="mt-1 text-xl font-extrabold text-[#1DE1B6]">₦<AnimatedCounter value={totalRewardValue} /></div>
          </div>
        </div>

        {dailyLoading || dailyStatus || dailyError ? (
          dailyLoading ? (
            <div className="mb-4 h-32 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ) : dailyStatus ? (
            <DailyRewardCard
              streak={dailyStatus.streak}
              nextStreak={dailyStatus.nextStreak}
              nextRewardAmount={dailyStatus.nextRewardAmount}
              canClaim={dailyStatus.canClaim}
              claiming={dailyClaiming}
              onClaim={handleClaimDailyReward}
            />
          ) : (
            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-red-300">
              {dailyError || "Daily reward data is unavailable"}
            </div>
          )
        ) : null}

        {noBoxesAvailable && (
          <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80">
            No boxes available
          </div>
        )}

        <div className="p-5 flex flex-col items-start w-full mb-6 rounded-2xl bg-gradient-to-r from-yellow-400/30 to-pink-500/20 border border-white/10 shadow-lg">
          <div className="flex w-full justify-between items-start mb-2">
            <div className="flex items-center">
              <span className="flex items-center px-3 py-1 rounded-full border border-white/40 text-white text-[12px] font-Poppins mr-2">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" className="mr-1">
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 8v4l3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Most Popular
              </span>
            </div>
            <div className="flex items-center bg-transparent rounded-lg px-3 py-1">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" className="mr-1"><circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="2" /><path d="M8 12h8M12 8v8" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
              <span className="text-white text-[12px] font-Poppins">₦{(boxes[0]?.price ?? 0).toLocaleString()}</span>
            </div>
          </div>
          <div className="flex w-full justify-center mb-2">
            <img src="/Boxes/box1.png" alt={boxes[0]?.name ?? "Featured box"} className="w-28 h-24 object-contain" />
          </div>
          <div className="text-white font-bold text-[16px] font-Rubik mb-1">{boxes[0]?.name ?? "Featured box"}</div>
          <div className="text-white/80 text-[12px] font-Poppins mb-4">Unlock rewards faster & win big airtime & cash prizes!</div>
          <button
            className="mt-2 mb-3 min-h-[48px] w-full cursor-pointer rounded-lg border border-white/60 bg-transparent px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-60"
            disabled={boxesLoading || isAnimatingOpenSequence || boxes.length === 0}
            onClick={() => {
              if (boxes[0]) {
                void handleOpen(0, boxes[0].id);
              }
            }}
          >
            {isAnimatingOpenSequence && opening === 0 ? <OpeningLabel /> : boxes[0] ? `Open Box - ₦${boxes[0].price.toLocaleString()}` : "Open Box"}
          </button>
          <div className="flex items-center gap-2 text-white/80 text-[12px] font-Poppins mt-2">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="2" /><path d="M12 8v4l3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="font-bold">POPULAR!</span> Live popularity updates from gameplay activity
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
                disabled={loading}
              >
                {retryingOpen ? "Retrying..." : "Retry"}
              </button>
            )}
          </div>
        )}

        {loading && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            <LoadingSpinner />
            Opening...
          </div>
        )}

        {roundLoading && (
          <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200 transition-all duration-300 ease-out">
            <div className="flex items-center gap-2">
              <LoadingSpinner />
              Loading next round...
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
          {boxesLoading && (
            <div className="col-span-full flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 p-4 text-sm text-white/80">
              <LoadingSpinner />
              Loading boxes...
            </div>
          )}

          {boxes.map((box, idx) => {
            if (idx === 0) {
              return (
                <button
                  key={box.id}
                  type="button"
                  className={`relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0f1a2d] shadow-lg transition-all duration-200 ease-out transform-gpu disabled:opacity-60 md:hover:-translate-y-1 md:hover:shadow-[0_18px_40px_rgba(0,0,0,0.35)] md:hover:border-white/20 active:scale-[0.98] ${opening === idx || revealingBoxIndex === idx ? 'ring-2 ring-[#1DE1B6] shadow-[0_0_0_1px_rgba(29,225,182,0.35),0_0_32px_rgba(29,225,182,0.28)]' : ''} ${opening === idx && animationPhase === 'anticipation' ? 'box-anticipation' : ''} ${opening === idx && animationPhase === 'spinning' ? 'box-spinning' : ''}`}
                  disabled={isAnimatingOpenSequence || boxesLoading || roundLoading}
                  onClick={() => {
                    void handleOpen(idx, box.id);
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/20" />
                  <div className="relative flex h-full w-full flex-col p-3 sm:p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0 text-left">
                        <div className="truncate text-sm font-extrabold uppercase tracking-wide text-white">{box.name}</div>
                        <div className="mt-1 text-[11px] font-semibold text-emerald-300">₦{box.price}</div>
                      </div>
                      <div className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold text-white/80">{idx + 1}</div>
                    </div>
                    <div className="relative flex flex-1 items-center justify-center">
                      <div className={`absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_center,rgba(29,225,182,0.22),transparent_65%)] transition-opacity duration-200 ${opening === idx || revealingBoxIndex === idx ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`} />
                      <Image src={box.image} alt={box.name} width={180} height={180} className={`relative max-h-[68%] w-auto object-contain transition-transform duration-200 ${loading && opening === idx ? 'scale-95' : 'md:group-hover:scale-105'}`} />
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2 text-[11px] text-white/75">
                      <span className="truncate">{box.win}</span>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide">Tap</span>
                    </div>
                    {isAnimatingOpenSequence && opening === idx && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/70 backdrop-blur-sm">
                        <OpeningLabel />
                      </div>
                    )}
                    {revealingBoxIndex === idx && reward !== null && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/80 animate-fade-in">
                        <div className="pointer-events-none absolute inset-0 box-explosion" />
                        <span className="mb-2 text-2xl font-bold text-yellow-300 drop-shadow-[0_0_24px_rgba(255,223,0,0.7)]">₦{reward.toLocaleString()}</span>
                        <span className="text-sm text-white">Reward unlocked</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            }

            if (idx === 1) {
              return (
                <button
                  key={box.id}
                  type="button"
                  className={`relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0f1a2d] shadow-lg transition-all duration-200 ease-out transform-gpu disabled:opacity-60 md:hover:-translate-y-1 md:hover:shadow-[0_18px_40px_rgba(0,0,0,0.35)] md:hover:border-white/20 active:scale-[0.98] ${opening === idx || revealingBoxIndex === idx ? 'ring-2 ring-[#1DE1B6] shadow-[0_0_0_1px_rgba(29,225,182,0.35),0_0_32px_rgba(29,225,182,0.28)]' : ''} ${opening === idx && animationPhase === 'anticipation' ? 'box-anticipation' : ''} ${opening === idx && animationPhase === 'spinning' ? 'box-spinning' : ''}`}
                  disabled={isAnimatingOpenSequence || boxesLoading || roundLoading}
                  onClick={() => {
                    void handleOpen(idx, box.id);
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/20" />
                  <div className="relative flex h-full w-full flex-col p-3 sm:p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0 text-left">
                        <div className="truncate text-sm font-extrabold uppercase tracking-wide text-white">{box.name}</div>
                        <div className="mt-1 text-[11px] font-semibold text-emerald-300">₦{box.price}</div>
                      </div>
                      <div className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold text-white/80">{idx + 1}</div>
                    </div>
                    <div className="relative flex flex-1 items-center justify-center">
                      <div className={`absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_center,rgba(29,225,182,0.22),transparent_65%)] transition-opacity duration-200 ${opening === idx || revealingBoxIndex === idx ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`} />
                      <Image src={box.image} alt={box.name} width={180} height={180} className={`relative max-h-[68%] w-auto object-contain transition-transform duration-200 ${loading && opening === idx ? 'scale-95' : 'md:group-hover:scale-105'}`} />
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2 text-[11px] text-white/75">
                      <span className="truncate">{box.win}</span>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide">Tap</span>
                    </div>
                    {isAnimatingOpenSequence && opening === idx && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/70 backdrop-blur-sm">
                        <OpeningLabel />
                      </div>
                    )}
                    {revealingBoxIndex === idx && reward !== null && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/80 animate-fade-in">
                        <div className="pointer-events-none absolute inset-0 box-explosion" />
                        <span className="mb-2 text-2xl font-bold text-yellow-300 drop-shadow-[0_0_24px_rgba(255,223,0,0.7)]">₦{reward.toLocaleString()}</span>
                        <span className="text-sm text-white">Reward unlocked</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            }

            return (
              <div
                key={box.id}
                className={`relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0f1a2d] shadow-lg transition-all duration-200 ease-out transform-gpu disabled:opacity-60 md:hover:-translate-y-1 md:hover:shadow-[0_18px_40px_rgba(0,0,0,0.35)] md:hover:border-white/20 active:scale-[0.98] ${opening === idx || revealingBoxIndex === idx ? 'ring-2 ring-[#1DE1B6] shadow-[0_0_0_1px_rgba(29,225,182,0.35),0_0_32px_rgba(29,225,182,0.28)]' : ''}`}
              >
                <button
                  type="button"
                  className="group flex h-full w-full flex-col rounded-2xl text-left"
                  disabled={isAnimatingOpenSequence || boxesLoading || roundLoading}
                  onClick={() => {
                    void handleOpen(idx, box.id);
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/20" />
                  <div className="relative flex h-full flex-col p-3 sm:p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0 text-left">
                        <div className="truncate text-sm font-extrabold uppercase tracking-wide text-white">{box.name}</div>
                        <div className="mt-1 text-[11px] font-semibold text-emerald-300">₦{box.price}</div>
                      </div>
                      <div className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold text-white/80">{idx + 1}</div>
                    </div>
                    <div className="relative flex flex-1 items-center justify-center">
                      <div className={`absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_center,rgba(29,225,182,0.22),transparent_65%)] transition-opacity duration-200 ${opening === idx || revealingBoxIndex === idx ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`} />
                    <Image
                      src={box.image}
                      alt={box.name}
                      width={140}
                      height={140}
                      className={`relative max-h-[68%] w-auto object-contain transition-transform duration-200 ${loading && opening === idx ? 'scale-95' : 'md:group-hover:scale-105'}`}
                    />
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2 text-[11px] text-white/75">
                      <span className="truncate">{box.win}</span>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide">Tap</span>
                    </div>
                    {isAnimatingOpenSequence && opening === idx && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/70 backdrop-blur-sm">
                        <OpeningLabel />
                      </div>
                    )}
                    {revealingBoxIndex === idx && reward !== null && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/80 animate-fade-in">
                        <div className="pointer-events-none absolute inset-0 box-explosion" />
                        <span className="mb-2 text-2xl font-bold text-yellow-300 drop-shadow-[0_0_24px_rgba(255,223,0,0.7)]">₦{reward.toLocaleString()}</span>
                        <span className="text-sm text-white">Reward unlocked</span>
                      </div>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-6 mb-6">
          <div className="mb-4 flex items-center gap-2 text-white">
            <Trophy className="h-7 w-7 text-[#1DE1B6]" fill="currentColor" />
            <span className="font-bold text-lg sm:text-[20px] font-Rubik tracking-[-0.03em]">TOP WINNERS TODAY</span>
          </div>

          {topWinnersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={`winner-skeleton-${idx}`}
                  className="h-16 animate-pulse rounded-2xl border border-white/10 bg-white/5"
                />
              ))}
            </div>
          ) : topWinnersError ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-center text-sm font-semibold text-red-300">
              {topWinnersError}
            </div>
          ) : topWinners.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-center text-sm font-semibold text-white/70">
              No winners yet
            </div>
          ) : (
            <div className="space-y-2">
              {topWinners.slice(0, TOP_WINNERS_LIMIT).map((winner, idx) => {
                const rank = idx + 1;
                const rankHighlight = getRankHighlight(rank);

                return (
                  <div
                    key={winner.userId}
                    className={`flex items-center gap-3 rounded-2xl border p-2.5 ${rank <= 3 ? "border-white/30 bg-white/10" : "border-white/10 bg-white/[0.04]"}`}
                  >
                    <div className={`grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br ${rankHighlight} text-xs font-black text-[#101b2a]`}>
                      {rank}
                    </div>

                    <div className={`h-11 w-11 overflow-hidden rounded-full bg-gradient-to-br p-[2px] ${rank <= 3 ? rankHighlight : "from-[#4A5B84] to-[#27375E]"}`}>
                      <div className="grid h-full w-full place-items-center rounded-full bg-[#09111f] text-sm font-extrabold text-white">
                        {getWinnerInitials(winner.username)}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">{winner.username}</div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-extrabold text-[#1DE1B6]">₦{Math.max(0, winner.totalEarnings).toLocaleString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <ReferralCard />

        <WinHistoryTimeline entries={winHistory} loading={winHistoryLoading} />

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.38, ease: [0.22, 0.61, 0.36, 1] }}
              className="relative max-h-[85dvh] w-[min(22rem,92vw)] overflow-y-auto rounded-2xl bg-[#101B2A] p-6 sm:p-8 flex flex-col items-center shadow-xl"
            >
              <div className="pointer-events-none absolute inset-0 modal-win-glow" />
              <div className="pointer-events-none absolute inset-0 modal-confetti" />
              <Image src="/trophy.png" alt="Trophy" width={60} height={60} className="mb-3" />
              <div className="mb-2 text-center text-xl font-bold text-green-400 sm:text-2xl">Congratulations!</div>
              <div className="mb-4 text-center text-base text-white sm:text-lg">
                You won <span className="font-bold text-yellow-300">₦{animatedRewardValue.toLocaleString()}</span>
              </div>
              <button
                className="mt-2 min-h-[44px] w-full rounded-lg bg-gradient-to-r from-blue-600 to-green-500 px-4 py-3 text-base font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  void handleContinue();
                }}
                disabled={roundLoading}
              >
                {roundLoading ? "Loading next round..." : "Continue"}
              </button>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
