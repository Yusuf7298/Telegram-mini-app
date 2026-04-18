import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { openFreeBox } from "@/lib/boxApi";
import { useWalletStore } from "@/store/walletStore";
import { useToast } from "@/components/ui/ToastProvider";

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `free_box_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function playRevealSound(reward: number) {
  if (typeof window === "undefined") {
    return;
  }

  const AnyWindow = window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextClass = window.AudioContext ?? AnyWindow.webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  const ctx = new AudioContextClass();
  const gain = ctx.createGain();
  gain.gain.value = 0.03;
  gain.connect(ctx.destination);

  const toneA = ctx.createOscillator();
  toneA.type = "triangle";
  toneA.frequency.value = 420;
  toneA.connect(gain);

  const toneB = ctx.createOscillator();
  toneB.type = "sine";
  toneB.frequency.value = reward >= 1000 ? 760 : 620;
  toneB.connect(gain);

  const now = ctx.currentTime;
  toneA.start(now);
  toneA.stop(now + 0.12);
  toneB.start(now + 0.08);
  toneB.stop(now + 0.28);

  setTimeout(() => {
    void ctx.close();
  }, 500);
}

type OpenPhase = "idle" | "anticipation" | "revealing" | "resolved" | "error";

export default function BoxAnimations() {
  const [phase, setPhase] = useState<OpenPhase>("idle");
  const [loading, setLoading] = useState(false);
  const [rewardAmount, setRewardAmount] = useState<number | null>(null);
  const [displayBalance, setDisplayBalance] = useState(0);
  const [balanceDelta, setBalanceDelta] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState("Ready to open");
  const [pendingIdempotencyKey, setPendingIdempotencyKey] = useState<string | null>(null);
  const [showFlash, setShowFlash] = useState(false);

  const rafRef = useRef<number | null>(null);
  const inFlightRequestRef = useRef<string | null>(null);
  const balanceRef = useRef(0);

  const cashBalance = useWalletStore((state) => state.cashBalance);
  const updateWalletFromResponse = useWalletStore((state) => state.updateWalletFromResponse);
  const fetchWallet = useWalletStore((state) => state.fetchWallet);
  const { showToast } = useToast();

  useEffect(() => {
    balanceRef.current = cashBalance;
    setDisplayBalance(cashBalance);
  }, []);

  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const start = balanceRef.current;
    const end = cashBalance;
    if (start === end) {
      return;
    }

    const duration = 650;
    const startTime = performance.now();

    const tick = (time: number) => {
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = start + (end - start) * eased;
      setDisplayBalance(next);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayBalance(end);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    balanceRef.current = end;
  }, [cashBalance]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const isProcessing =
    loading ||
    phase === "anticipation" ||
    phase === "revealing" ||
    Boolean(inFlightRequestRef.current);

  const cardAnimationClass =
    phase === "anticipation" ? "box-anticipation" : phase === "revealing" ? "box-spinning" : "";
  const rewardRevealClass = phase === "resolved" ? "box-explosion" : "";

  const handleOpenFreeBox = async (options?: { retryWithPendingKey?: boolean }) => {
    if (isProcessing) {
      return;
    }

    const retryWithPendingKey = Boolean(options?.retryWithPendingKey && pendingIdempotencyKey);
    const idempotencyKey = retryWithPendingKey && pendingIdempotencyKey ? pendingIdempotencyKey : createIdempotencyKey();
    inFlightRequestRef.current = idempotencyKey;
    setPendingIdempotencyKey(idempotencyKey);

    setLoading(true);
    setPhase("anticipation");
    setStatusMessage("Locking your attempt...");
    setRewardAmount(null);
    setBalanceDelta(null);

    try {
      await wait(420);
      setPhase("revealing");
      setStatusMessage("Opening box...");

      const response = await openFreeBox({
        idempotencyKey,
        timestamp: Date.now(),
      });

      const reward = Number(response.data.data.reward ?? 0);
      const normalizedReward = Number.isFinite(reward) ? reward : 0;

      await wait(840);

      setPhase("resolved");
      setStatusMessage("Reward revealed");
      setRewardAmount(normalizedReward);
      setShowFlash(true);
      playRevealSound(normalizedReward);

      const previousBalance = balanceRef.current;
      setTimeout(() => {
        setShowFlash(false);
      }, 320);

      const updated = updateWalletFromResponse(response.data);
      if (!updated) {
        await fetchWallet();
      }

      const latestBalance = useWalletStore.getState().cashBalance;
      const delta = latestBalance - previousBalance;
      setBalanceDelta(delta > 0 ? delta : normalizedReward);

      setPendingIdempotencyKey(null);

      showToast({
        type: "success",
        message: `Free box opened: ${normalizedReward.toLocaleString()}`,
      });
    } catch {
      setPhase("error");
      setStatusMessage("Open failed. Retry uses the same safe request key.");
      showToast({ type: "error", message: "Failed to open free box. Tap retry." });
    } finally {
      inFlightRequestRef.current = null;
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className={`relative w-[350px] h-[301px] mb-4 rounded-xl overflow-hidden shadow-lg bg-gradient-to-br from-[#0f2c3f] to-[#1e5a3a] p-0 mx-auto ${cardAnimationClass} ${rewardRevealClass}`}
      >
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

        {showFlash ? (
          <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-br from-[#ffe06f]/50 via-[#1de1b6]/15 to-transparent" />
        ) : null}

        {/* Coins and Box */}
        <div className="absolute left-1/2 top-[60px] -translate-x-1/2 z-10 flex flex-col items-center animate-float">
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
          <div className="text-white text-[14px] text-center opacity-85 mb-1">{statusMessage}</div>
          <div className="text-[#D9FFF5] text-[13px] mb-3 text-center">Balance: {Math.round(displayBalance).toLocaleString()}</div>
          <button
            className="w-full border border-white rounded-lg px-8 py-2 text-white font-bold hover:bg-white hover:text-[#1e5a3a] transition mb-2 disabled:opacity-70 disabled:cursor-not-allowed"
            onClick={() => {
              void handleOpenFreeBox({ retryWithPendingKey: phase === "error" });
            }}
            disabled={isProcessing}
          >
            {isProcessing ? "OPENING..." : phase === "error" ? "RETRY OPEN" : "OPEN FREE BOX"}
          </button>
          <div className="min-h-[22px] text-center">
            {rewardAmount !== null && phase === "resolved" ? (
              <div className="text-white text-[14px] font-semibold">
                Reward: {rewardAmount.toLocaleString()}
                {balanceDelta && balanceDelta > 0 ? (
                  <span className="ml-2 rounded-full bg-[#1de1b6]/20 px-2 py-0.5 text-[#9EFDE8]">+{Math.round(balanceDelta).toLocaleString()}</span>
                ) : null}
              </div>
            ) : (
              <div className="text-[12px] text-white/70">Secure idempotency key protects retries while processing.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}