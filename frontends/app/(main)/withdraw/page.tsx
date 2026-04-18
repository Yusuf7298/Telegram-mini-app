"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Wallet, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { ApiResponse } from '@/lib/apiTypes';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/ToastProvider';
import { useWalletStore, WALLET_REFRESH_EVENT } from "@/store/walletStore";
import NotificationCenter from '@/components/notification/NotificationCenter';

type WithdrawData = {
  cashBalance?: number | string;
  bonusBalance?: number | string;
  airtimeBalance?: number | string;
};

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `withdraw_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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

export default function WithdrawPage() {
  const cash = useWalletStore((state) => state.cashBalance);
  const airtime = useWalletStore((state) => state.airtimeBalance);
  const walletLoading = useWalletStore((state) => state.loading);
  const fetchWallet = useWalletStore((state) => state.fetchWallet);
  const updateWalletFromResponse = useWalletStore((state) => state.updateWalletFromResponse);

  const [balanceType, setBalanceType] = useState<"cash" | "airtime">("cash");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [retryingWithdraw, setRetryingWithdraw] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [lastAttempt, setLastAttempt] = useState<{ amount: string; idempotencyKey: string } | null>(null);
  const { showToast } = useToast();
  const router = useRouter();

  const selectedBalance = useMemo(
    () => (balanceType === "cash" ? cash : airtime),
    [airtime, balanceType, cash]
  );

  useEffect(() => {
    void fetchWallet();
  }, [fetchWallet]);

  const executeWithdraw = async (attempt: { amount: string; idempotencyKey: string }, isRetry = false) => {
    if (loading) {
      return;
    }

    setLoading(true);
    setRetryingWithdraw(isRetry);
    setWithdrawError(null);

    try {
      const response = await api.post<ApiResponse<WithdrawData>>("/wallet/withdraw", {
        amount: attempt.amount,
        idempotencyKey: attempt.idempotencyKey,
      });

      const updated = updateWalletFromResponse(response.data);
      if (!updated) {
        await fetchWallet();
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(WALLET_REFRESH_EVENT));
      }

      showToast({ type: 'success', message: 'Withdrawal successful' });
      setAmount("");
      setLastAttempt(null);
    } catch (requestError) {
      const message =
        typeof requestError === 'object' && requestError !== null && 'message' in requestError
          ? String((requestError as { message?: unknown }).message ?? 'Withdrawal failed. Please try again.')
          : 'Withdrawal failed. Please try again.';
      setWithdrawError(message);
      setLastAttempt(attempt);
    } finally {
      setLoading(false);
      setRetryingWithdraw(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) {
      return;
    }

    const cleanedAmount = amount.trim();
    const amt = Number(cleanedAmount);
    if (!cleanedAmount || Number.isNaN(amt) || amt <= 0) {
      showToast({ type: 'info', message: 'Enter a valid amount' });
      return;
    }

    if (amt > selectedBalance) {
      showToast({ type: 'info', message: `Cannot withdraw more than ${balanceType} balance` });
      return;
    }

    const attempt = {
      amount: cleanedAmount,
      idempotencyKey: createIdempotencyKey(),
    };

    setLastAttempt(attempt);
    await executeWithdraw(attempt);
  };

  const handleRetryLastAttempt = async () => {
    if (!lastAttempt || loading) {
      return;
    }

    await executeWithdraw(lastAttempt, true);
  };

  function handleClick() {
    // Handle back navigation
    router.back();
  }


  const balanceCardClass =
    "flex-1 rounded-2xl border bg-white/5 px-4 py-4 text-left transition";
  const amountFieldClass =
    "w-full rounded-2xl border border-white/10 bg-[#131c31] px-4 py-4 text-[15px] font-Poppins text-white outline-none placeholder:text-white/40 focus:border-[#18e0a8] focus:ring-2 focus:ring-[#18e0a8]/20";

  return (
    <div className="min-h-telegram-screen safe-screen-padding overflow-x-hidden bg-gradient-to-bl from-[#2C5364] via-[#000000] to-[#020617] pb-28">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-[radial-gradient(circle_at_top,_rgba(11,38,63,0.9),_rgba(0,6,18,1)_72%)]">
        <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-gray-800">
        <button onClick={handleClick} aria-label="Go back" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-transparent text-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="text-base font-bold text-white">Withdraw</div>
        <NotificationCenter />
      </div>

        <form className="flex flex-1 flex-col px-4 pt-10" onSubmit={handleSubmit}>
          <div className="rounded-[28px] border border-white/10 bg-[#0b1526]/80 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            <div className="mb-5 text-[16px] font-Rubik font-black tracking-[-0.03em] uppercase text-white">BALANCE</div>
            {walletLoading && (
              <div className="mb-3 flex items-center gap-2 text-sm text-white/70">
                <LoadingSpinner />
                Loading wallet...
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setBalanceType("cash")}
                className={`${balanceCardClass} ${balanceType === "cash"
                  ? "border-[#18e0a8] bg-[#0a2b2c] text-[#11d29c] shadow-[0_0_0_1px_rgba(24,224,168,0.18),0_0_24px_rgba(24,224,168,0.08)]"
                  : "border-white/8 text-white/80 hover:bg-white/8"
                  }`}
              >
                <div className="mb-4 flex items-center gap-2 text-[14px] font-regular font-Poppins text-white">
                  <Wallet className={`h-5 w-5 ${balanceType === "cash" ? "text-[#FFFFFFCC]" : "text-white/60"}`} />
                  Cash
                </div>
                <div className="text-[16px] font-Rubik tracking-[-0.04em] text-white/80 leading-none">₦{toSafeNumber(cash).toLocaleString()}</div>
              </button>
              <button
                type="button"
                onClick={() => setBalanceType("airtime")}
                className={`${balanceCardClass} ${balanceType === "airtime"
                  ? "border-[#18e0a8] bg-[#0a2b2c] text-[#FFFFFFCC] shadow-[0_0_0_1px_rgba(24,224,168,0.18),0_0_24px_rgba(24,224,168,0.08)]"
                  : "border-white/8 text-white/80 hover:bg-white/8"
                  }`}
              >
                <div className="mb-4 flex items-center gap-2 text-[14px] font-regular font-Poppins text-white">
                  <Smartphone className={`h-5 w-5 ${balanceType === "airtime" ? "text-[#FFFFFFCC]" : "text-white/60"}`} />
                  Airtime
                </div>
                <div className="text-[16px] font-Rubik tracking-[-0.04em] text-white/80 leading-none">₦{toSafeNumber(airtime).toLocaleString()}</div>
              </button>
            </div>
          </div>

          <div className="mt-8 rounded-[28px] border border-white/10 bg-[#0b1526]/80 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            <label className="block">
              <span className="mb-2 block text-[14px] font-Rubik text-white/90">Amount</span>
              <input
                className={amountFieldClass}
                name="amount"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="numeric"
                aria-label="Withdrawal amount"
              />
            </label>
            {lastAttempt && (
              <div className="mt-3">
                {withdrawError ? <p className="mb-2 text-sm text-red-300">{withdrawError}</p> : null}
                <button
                  type="button"
                  className="min-h-[44px] rounded-md bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-60"
                  disabled={loading}
                  onClick={() => {
                    void handleRetryLastAttempt();
                  }}
                >
                  {retryingWithdraw ? 'Retrying...' : 'Retry'}
                </button>
              </div>
            )}
            {loading && (
              <div className="mt-2 flex items-center gap-2 text-sm text-emerald-300">
                <LoadingSpinner />
                Processing request...
              </div>
            )}
          </div>

          <button
            type="submit"
            className="mt-auto mb-2 min-h-[48px] w-full rounded-2xl bg-[#18e0a8] py-4 text-sm font-Rubik font-black tracking-tight text-black transition hover:bg-[#12d59f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18e0a8]/70 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Processing..." : "WITHDRAW"}
          </button>
        </form>
      </div>
    </div>
  );
}
