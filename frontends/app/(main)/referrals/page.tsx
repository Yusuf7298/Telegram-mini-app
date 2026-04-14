"use client";
import { FormEvent, useEffect, useState } from "react";
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/ToastProvider';
import { applyReferralCode, getReferralCode } from "@/lib/referralApi";
import { getTelegramInitData } from "@/lib/telegram";

type ReferralRetryAttempt = {
  code: string;
  idempotencyKey: string;
};

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `ref_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function ReferralsPage() {
  const [initData, setInitData] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [retryingReferral, setRetryingReferral] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [lastAttempt, setLastAttempt] = useState<ReferralRetryAttempt | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    const telegramInitData = getTelegramInitData();
    setInitData(telegramInitData);

    const loadReferralCode = async () => {
      if (!telegramInitData) {
        showToast({ type: 'error', message: 'Telegram session is required to load referral data' });
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const response = await getReferralCode(telegramInitData);
        setReferralCode(response.data.data.referralCode);
      } catch (requestError) {
        void requestError;
      } finally {
        setLoading(false);
      }
    };

    void loadReferralCode();
  }, []);

  const handleShare = () => {
    if (!referralCode) {
      return;
    }

    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    showToast({ type: 'info', message: 'Referral code copied' });
    setTimeout(() => setCopied(false), 1200);
  };

  const executeApplyReferral = async (attempt: ReferralRetryAttempt, isRetry = false) => {
    if (submitting) return;

    setSubmitting(true);
    setRetryingReferral(isRetry);
    setApplyError(null);

    try {
      await applyReferralCode(attempt.code, initData as string, undefined, attempt.idempotencyKey);
      showToast({ type: 'success', message: 'Referral code applied successfully' });
      setCodeInput("");
      setLastAttempt(null);
    } catch (requestError) {
      const message =
        typeof requestError === 'object' && requestError !== null && 'message' in requestError
          ? String((requestError as { message?: unknown }).message ?? 'Referral apply failed. Please try again.')
          : 'Referral apply failed. Please try again.';
      setApplyError(message);
      setLastAttempt(attempt);
    } finally {
      setSubmitting(false);
      setRetryingReferral(false);
    }
  };

  const handleApplyReferral = async (event: FormEvent) => {
    event.preventDefault();

    if (!initData) {
      showToast({ type: 'error', message: 'Telegram session is required' });
      return;
    }

    const code = codeInput.trim();
    if (!code) {
      showToast({ type: 'info', message: 'Enter a referral code' });
      return;
    }

    const attempt: ReferralRetryAttempt = {
      code,
      idempotencyKey: createIdempotencyKey(),
    };

    await executeApplyReferral(attempt);
  };

  const handleRetryReferral = async () => {
    if (!lastAttempt || submitting) return;
    await executeApplyReferral(lastAttempt, true);
  };

  return (
    <div className="min-h-telegram-screen safe-screen-padding bg-gradient-to-b from-[#0b1526] to-[#08101d] px-4 py-6 flex flex-col items-center overflow-x-hidden">
      {/* Referral Code Card */}
      <div className="mt-2 mb-4 flex w-full max-w-sm flex-col items-center rounded-2xl bg-[#101B2A] p-5 shadow-lg sm:p-6">
        <div className="mb-2 text-lg font-bold text-white">Your Referral Code</div>
        <div className="mb-4 flex w-full flex-wrap items-center justify-center gap-2">
          <span className="flex min-h-[44px] items-center rounded-lg bg-[#232B3C] px-4 py-2 text-base font-mono tracking-widest text-blue-400 sm:text-lg">
            {loading ? (
              <span className="flex items-center gap-2 text-sm text-blue-300">
                <LoadingSpinner />
                Loading...
              </span>
            ) : (referralCode || "Unavailable")}
          </span>
          <button
            className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            onClick={handleShare}
            disabled={loading || !referralCode}
            aria-label="Copy referral code"
          >
            {copied ? "Copied!" : "Share"}
          </button>
        </div>
      </div>

      {/* Apply Referral */}
      <div className="mb-4 flex w-full max-w-sm flex-col items-center rounded-2xl bg-[#101B2A] p-4 shadow-lg sm:p-5">
        <div className="mb-2 text-lg font-bold text-white">Apply Referral</div>

        <form className="w-full" onSubmit={handleApplyReferral}>
          <input
            className="w-full rounded-lg bg-[#19233A] border border-[#232B3C] focus:border-blue-500 px-3 py-3 text-white outline-none placeholder-gray-500"
            placeholder="Enter referral code"
            value={codeInput}
            onChange={(event) => setCodeInput(event.target.value.toUpperCase())}
            maxLength={16}
            aria-label="Referral code"
          />

          <button
            type="submit"
            className="mt-3 min-h-[44px] w-full rounded-lg bg-blue-600 px-3 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting || loading || !initData}
          >
            {submitting ? "Applying..." : "Apply Referral"}
          </button>
        </form>

        {lastAttempt ? (
          <div className="mt-3 w-full">
            {applyError ? <p className="mb-2 text-sm text-red-300">{applyError}</p> : null}
            <button
              type="button"
              className="min-h-[44px] w-full rounded-lg bg-white/10 px-3 py-3 text-sm font-semibold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
              onClick={() => {
                void handleRetryReferral();
              }}
            >
              {retryingReferral ? 'Retrying...' : 'Retry'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
