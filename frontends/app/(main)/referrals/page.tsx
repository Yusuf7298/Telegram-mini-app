"use client";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/ToastProvider';
import { applyReferralCode, getReferralCode, getReferralList, ReferralListData, ReferralListItem } from "@/lib/referralApi";
import { env } from "@/lib/env";
import { getTelegramInitData } from "@/lib/telegram";
import { useNotificationStore } from '@/store/notificationStore';
import { useWalletStore } from '@/store/walletStore';
import { getGameConfig } from "@/lib/gameConfigApi";
import { ReferralList } from "@/components/referral/ReferralList";
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling';

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

function toNormalizedStatus(value: string) {
  return value.toUpperCase();
}

const REFERRAL_SHARE_TEXT = 'Join this game and get free rewards 🎁';
const REFERRAL_POLL_INTERVAL_MS = 20000;

export default function ReferralsPage() {
  const [initData, setInitData] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingReferrals, setLoadingReferrals] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [retryingReferral, setRetryingReferral] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [lastAttempt, setLastAttempt] = useState<ReferralRetryAttempt | null>(null);
  const [referralRewardAmount, setReferralRewardAmount] = useState<number | null>(null);
  const [referralMilestoneTarget, setReferralMilestoneTarget] = useState<number | null>(null);
  const [referralMilestoneBonus, setReferralMilestoneBonus] = useState<number | null>(null);
  const [referrals, setReferrals] = useState<ReferralListItem[]>([]);
  const [referralError, setReferralError] = useState<string | null>(null);
  const { showToast } = useToast();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const updateWalletFromResponse = useWalletStore((state) => state.updateWalletFromResponse);
  const fetchWallet = useWalletStore((state) => state.fetchWallet);
  const prevStatusByUserRef = useRef<Record<string, string>>({});
  const activeNotificationSentRef = useRef<Record<string, boolean>>({});
  const hasBootstrappedReferralsRef = useRef(false);

  const inviteLink = useMemo(() => {
    if (!referralCode) {
      return "";
    }

    const configuredFrontendUrl = env.FRONTEND_URL.replace(/\/$/, '');
    const baseUrl = configuredFrontendUrl || (typeof window !== "undefined" ? window.location.origin : '');
    if (!baseUrl) {
      return "";
    }

    return `${baseUrl}?ref=${referralCode}`;
  }, [referralCode]);

  const referralShareText = useMemo(() => {
    if (!inviteLink) {
      return '';
    }

    return `${REFERRAL_SHARE_TEXT}\n${inviteLink}`;
  }, [inviteLink]);

  const telegramShareUrl = useMemo(() => {
    if (!inviteLink) {
      return '';
    }

    return `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(REFERRAL_SHARE_TEXT)}`;
  }, [inviteLink]);

  const whatsappShareUrl = useMemo(() => {
    if (!inviteLink) {
      return '';
    }

    return `https://wa.me/?text=${encodeURIComponent(referralShareText)}`;
  }, [inviteLink, referralShareText]);

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

  const refreshReferralData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!initData) {
        if (!options?.silent) {
          setLoadingReferrals(false);
          setReferralError('Telegram session is required to load referral data');
        }
        return;
      }

      if (!options?.silent) {
        setLoadingReferrals(true);
        setReferralError(null);
      }

      try {
        const response = await getReferralList(initData);
        const payload: ReferralListData = response.data.data;

        setReferrals(payload.referrals);

        const nextStatusByUser = payload.referrals.reduce<Record<string, string>>((acc, referral) => {
          const userKey = referral.referredUserId;
          acc[userKey] = toNormalizedStatus(referral.status);
          return acc;
        }, {});

        if (hasBootstrappedReferralsRef.current) {
          payload.referrals.forEach((referral) => {
            const userKey = referral.referredUserId;
            const currentStatus = toNormalizedStatus(referral.status);
            const previousStatus = prevStatusByUserRef.current[userKey];
            const label = referral.user?.trim() || `User ${userKey.slice(0, 6)}`;

            // Notify only on true activation transition
            if (
              previousStatus === 'JOINED' &&
              currentStatus === 'ACTIVE' &&
              !activeNotificationSentRef.current[userKey]
            ) {
              activeNotificationSentRef.current[userKey] = true;
              const rewardText = `₦${Number(referral.reward ?? 0).toLocaleString()}`;
              addNotification({
                kind: 'referral',
                title: 'Referral became ACTIVE',
                message: `${label} is now ACTIVE. Reward earned: ${rewardText}.`,
              });
              showToast({ type: 'success', message: `${label} became ACTIVE. Reward ${rewardText}` });
            }
          });
        }

        prevStatusByUserRef.current = nextStatusByUser;
        hasBootstrappedReferralsRef.current = true;
      } catch (error) {
        const message =
          typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message?: unknown }).message ?? 'Failed to load referral statuses')
            : 'Failed to load referral statuses';

        setReferralError(message);
        if (!options?.silent) {
          showToast({ type: 'error', message });
        }
      } finally {
        if (!options?.silent) {
          setLoadingReferrals(false);
        }
      }
    },
    [addNotification, initData, showToast]
  );

  useVisibilityPolling(
    useCallback(() => {
      if (!initData) {
        return;
      }

      void refreshReferralData({ silent: true });
    }, [initData, refreshReferralData]),
    REFERRAL_POLL_INTERVAL_MS
  );

  useEffect(() => {
    const handleReferralRefresh = () => {
      if (document.visibilityState === 'visible') {
        void refreshReferralData({ silent: true });
      }
    };

    window.addEventListener('referrals:refresh', handleReferralRefresh as EventListener);

    return () => {
      window.removeEventListener('referrals:refresh', handleReferralRefresh as EventListener);
    };
  }, [refreshReferralData]);

  useEffect(() => {
    const loadGameConfig = async () => {
      try {
        const response = await getGameConfig();
        const config = response.data.data;
        const amountRaw = config.referralRewardAmount;
        const amount = typeof amountRaw === "number" ? amountRaw : Number(String(amountRaw));
        if (Number.isFinite(amount) && amount > 0) {
          setReferralRewardAmount(amount);
        }

        const targetRaw = config.maxReferralsPerIpPerDay;
        const target = typeof targetRaw === "number" ? targetRaw : Number(String(targetRaw));
        if (Number.isFinite(target) && target > 0) {
          setReferralMilestoneTarget(Math.floor(target));
        }

        const bonusRaw = config.waitlistBonus;
        const bonus = typeof bonusRaw === "number" ? bonusRaw : Number(String(bonusRaw));
        if (Number.isFinite(bonus) && bonus >= 0) {
          setReferralMilestoneBonus(bonus);
        }
      } catch {
        // Non-blocking for referral page.
      }
    };

    void loadGameConfig();
  }, []);

  const copyInviteLink = async () => {
    if (!inviteLink) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      showToast({ type: 'success', message: 'Invite link copied' });
      addNotification({
        kind: 'system',
        title: 'Invite copied',
        message: 'Your referral invite link is ready to share.',
      });
      window.setTimeout(() => setCopied(false), 900);
      return true;
    } catch {
      showToast({ type: 'error', message: 'Failed to copy invite link' });
      return false;
    }
  };

  const handleCopyInviteLink = async () => {
    void (await copyInviteLink());
  };

  const handleInviteClick = async () => {
    if (!inviteLink) {
      showToast({ type: 'error', message: 'Invite link unavailable' });
      return;
    }

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Invite & Earn Rewards',
          text: REFERRAL_SHARE_TEXT,
          url: inviteLink,
        });

        showToast({ type: 'success', message: 'Invite shared successfully' });
        addNotification({
          kind: 'referral',
          title: 'Invite shared',
          message: 'Your referral invite was shared successfully.',
        });
        return;
      } catch {
        // Continue to clipboard fallback when share is unavailable or cancelled.
      }
    }

    const copiedInvite = await copyInviteLink();
    if (copiedInvite) {
      showToast({ type: 'success', message: 'Invite link copied. Share it anywhere.' });
      addNotification({
        kind: 'referral',
        title: 'Invite ready',
        message: 'Invite link copied to clipboard.',
      });
    }
  };

  const openShareWindow = (url: string) => {
    if (!url) {
      return false;
    }

    const shareWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (!shareWindow) {
      showToast({ type: 'error', message: 'Popup blocked. Please allow popups to share.' });
      return false;
    }

    shareWindow.opener = null;
    return true;
  };

  const handleTelegramShare = async () => {
    if (!telegramShareUrl) {
      return;
    }

    openShareWindow(telegramShareUrl);
    addNotification({
      kind: 'referral',
      title: 'Shared on Telegram',
      message: 'Your referral link is ready in Telegram share.',
    });
  };

  const handleWhatsAppShare = async () => {
    if (!whatsappShareUrl) {
      return;
    }

    openShareWindow(whatsappShareUrl);
    addNotification({
      kind: 'referral',
      title: 'Shared on WhatsApp',
      message: 'Your referral link is ready in WhatsApp share.',
    });
  };

  const executeApplyReferral = async (attempt: ReferralRetryAttempt, isRetry = false) => {
    if (submitting) return;

    setSubmitting(true);
    setRetryingReferral(isRetry);
    setApplyError(null);

    try {
      const response = await applyReferralCode(attempt.code, initData as string, undefined, attempt.idempotencyKey);
      const updated = updateWalletFromResponse(response.data);
      if (!updated) {
        await fetchWallet();
      }

      showToast({ type: 'success', message: 'Referral code applied successfully' });
      addNotification({
        kind: 'referral',
        title: 'Referral activated',
        message: `You successfully activated referral code ${attempt.code}.`,
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('referrals:refresh'));
      }
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

  const totalReferralsCount = referrals.length;
  const activeReferralsCount = referrals.reduce((count, referral) => {
    const status = String(referral.status).toUpperCase();
    return status === "ACTIVE" ? count + 1 : count;
  }, 0);
  const totalEarnedFromReferrals = referrals.reduce((sum, referral) => {
    const reward = Number(referral.reward ?? 0);
    return Number.isFinite(reward) ? sum + reward : sum;
  }, 0);

  const milestoneTarget =
    referralMilestoneTarget && referralMilestoneTarget > 0 ? referralMilestoneTarget : null;
  const milestoneProgress = milestoneTarget !== null ? Math.min(totalReferralsCount, milestoneTarget) : 0;
  const milestoneProgressPercent =
    milestoneTarget !== null && milestoneTarget > 0
      ? Math.max(0, Math.min(100, Math.round((milestoneProgress / milestoneTarget) * 100)))
      : 0;
  const referralsRemainingToMilestone =
    milestoneTarget !== null ? Math.max(milestoneTarget - totalReferralsCount, 0) : null;

  return (
    <div className="min-h-telegram-screen safe-screen-padding bg-gradient-to-b from-[#0b1526] to-[#08101d] px-4 py-6 flex flex-col items-center overflow-x-hidden">
      {/* Referral Code Card */}
      <div className="mt-2 mb-4 flex w-full max-w-sm flex-col items-center rounded-2xl bg-[#101B2A] p-5 shadow-lg sm:p-6">
        <div className="mb-2 w-full text-left text-lg font-bold text-white">Your Referral Code</div>
        <div className="mb-4 w-full">
          <span className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#232B3C] px-4 py-2 text-base font-mono tracking-widest text-blue-400 sm:text-lg">
            {loading ? (
              <span className="flex items-center gap-2 text-sm text-blue-300">
                <LoadingSpinner />
                Loading...
              </span>
            ) : (referralCode || "Unavailable")}
          </span>
        </div>

        <div className="mb-2 w-full text-left text-sm font-semibold text-white/90">Your Invite Link</div>
        <div className="w-full rounded-lg bg-[#19233A] border border-[#232B3C] px-3 py-3 text-xs text-blue-200 break-all">
          {inviteLink || "Invite link unavailable"}
        </div>

        <button
          className="mt-4 min-h-[48px] w-full rounded-xl bg-gradient-to-r from-[#19C37D] to-[#0FA968] px-4 py-3 text-base font-bold text-white shadow-lg transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => {
            void handleInviteClick();
          }}
          disabled={loading || !referralCode}
        >
          Invite & Earn Rewards
        </button>

        {referralRewardAmount !== null ? (
          <p className="mt-2 w-full text-left text-xs font-semibold text-emerald-300">
            Current reward per activation: ₦{referralRewardAmount.toLocaleString()}
          </p>
        ) : null}

        <div className="mt-3 grid w-full grid-cols-3 gap-2">
          <button
            className={`min-h-[44px] w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-60 ${copied ? 'copied-pop' : ''}`}
            onClick={() => {
              void handleCopyInviteLink();
            }}
            disabled={loading || !referralCode}
            aria-label="Copy invite link"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            className="min-h-[44px] w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void handleTelegramShare();
            }}
            disabled={loading || !telegramShareUrl}
            aria-label="Share invite link on Telegram"
          >
            Telegram
          </button>
          <button
            className="min-h-[44px] w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void handleWhatsAppShare();
            }}
            disabled={loading || !whatsappShareUrl}
            aria-label="Share invite link on WhatsApp"
          >
            WhatsApp
          </button>
        </div>

        {copied ? (
          <p className="mt-2 w-full text-left text-xs font-semibold text-emerald-300">
            Copied!
          </p>
        ) : null}
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

      <div className="mb-4 flex w-full max-w-sm flex-col rounded-2xl bg-[#101B2A] p-4 shadow-lg sm:p-5">
        <div className="mb-3 text-lg font-bold text-white">Referral Progress Dashboard</div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-[#19233A] p-3">
            <div className="text-[11px] text-white/65">Total referrals</div>
            <div className="mt-1 text-sm font-bold text-white">{totalReferralsCount.toLocaleString()}</div>
          </div>
          <div className="rounded-xl bg-[#19233A] p-3">
            <div className="text-[11px] text-white/65">Total earned</div>
            <div className="mt-1 text-sm font-bold text-emerald-300">₦{totalEarnedFromReferrals.toLocaleString()}</div>
          </div>
          <div className="rounded-xl bg-[#19233A] p-3">
            <div className="text-[11px] text-white/65">Active referrals</div>
            <div className="mt-1 text-sm font-bold text-white">{activeReferralsCount.toLocaleString()}</div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-[#19233A] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-white">Next reward milestone</div>
            <div className="text-xs font-semibold text-emerald-300">{milestoneProgressPercent}%</div>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 transition-all duration-300"
              style={{ width: `${milestoneProgressPercent}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-white/75">
            {milestoneTarget !== null
              ? `${milestoneTarget.toLocaleString()} referrals → ${referralMilestoneBonus !== null ? `₦${referralMilestoneBonus.toLocaleString()} bonus` : 'bonus'}`
              : 'Milestone target unavailable from backend config'}
          </div>
          <div className="mt-1 text-[11px] text-white/55">
            {referralsRemainingToMilestone === null
              ? 'Update game config to publish milestone target'
              : referralsRemainingToMilestone > 0
                ? `${referralsRemainingToMilestone.toLocaleString()} more referrals to reach milestone`
                : 'Milestone reached'}
          </div>
        </div>
      </div>

      <div className="mb-4 flex w-full max-w-sm flex-col rounded-2xl bg-[#101B2A] p-4 shadow-lg sm:p-5">
        <div className="mb-3 text-lg font-bold text-white">Referral Status</div>
        {loadingReferrals ? (
          <div className="flex items-center gap-2 rounded-lg bg-[#19233A] p-3 text-sm text-white/80">
            <LoadingSpinner />
            Loading referral statuses...
          </div>
        ) : referralError ? (
          <div className="rounded-lg bg-[#19233A] p-3 text-sm text-red-300">{referralError}</div>
        ) : (
          <ReferralList referrals={referrals} />
        )}
      </div>
    </div>
  );
}
