"use client";
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bell, Copy, Settings, Share2, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useWalletStore } from '@/store/walletStore';
import { useNotificationStore } from '@/store/notificationStore';
import { NotificationList } from '@/components/notification/NotificationList';
import { ReferralList } from '@/components/referral/ReferralList';
import { getReferralList, ReferralListData, ReferralListItem } from '@/lib/referralApi';
import { getTelegramInitData } from '@/lib/telegram';
import { useToast } from '@/components/ui/ToastProvider';
import { env } from '@/lib/env';
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling';

const REFERRAL_SHARE_TEXT = 'Join this game and get free rewards 🎁';
const REFERRAL_POLL_INTERVAL_MS = 20000;

function toNormalizedStatus(value: string) {
  return value.toUpperCase();
}

export default function AccountPage() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const [copiedLink, setCopiedLink] = useState(false);
  const [loadingReferrals, setLoadingReferrals] = useState(true);
  const [referrals, setReferrals] = useState<ReferralListItem[]>([]);
  const [activeReferrals, setActiveReferrals] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [referralError, setReferralError] = useState<string | null>(null);
  const { showToast } = useToast();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const fetchWallet = useWalletStore((state) => state.fetchWallet);
  const cashBalance = useWalletStore((state) => state.cashBalance);
  const bonusBalance = useWalletStore((state) => state.bonusBalance);
  const airtimeBalance = useWalletStore((state) => state.airtimeBalance);
  const prevStatusByUserRef = useRef<Record<string, string>>({});
  const activeNotificationSentRef = useRef<Record<string, boolean>>({});
  const hasBootstrappedReferralsRef = useRef(false);
  const referralCode = user?.referralCode || 'Unavailable';
  const profileName = user?.username || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Telegram User';

  const referralLink = useMemo(() => {
    if (!referralCode || referralCode === 'Unavailable') {
      return '';
    }

    const configuredFrontendUrl = env.FRONTEND_URL.replace(/\/$/, '');
    const baseUrl = configuredFrontendUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    if (!baseUrl) {
      return '';
    }

    return `${baseUrl}?ref=${encodeURIComponent(referralCode)}`;
  }, [referralCode]);

  const referralShareText = useMemo(() => {
    if (!referralLink) {
      return '';
    }

    return `${REFERRAL_SHARE_TEXT}\n${referralLink}`;
  }, [referralLink]);

  const telegramShareUrl = useMemo(() => {
    if (!referralLink) {
      return '';
    }

    return `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(REFERRAL_SHARE_TEXT)}`;
  }, [referralLink]);

  const whatsappShareUrl = useMemo(() => {
    if (!referralLink) {
      return '';
    }

    return `https://wa.me/?text=${encodeURIComponent(referralShareText)}`;
  }, [referralLink, referralShareText]);

  const refreshReferralData = useCallback(
    async (options?: { silent?: boolean }) => {
      const telegramInitData = getTelegramInitData();

      if (!telegramInitData) {
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
        const response = await getReferralList(telegramInitData);
        const payload: ReferralListData = response.data.data;

        setReferrals(payload.referrals);
        setActiveReferrals(payload.totals.activeReferrals);
        setTotalEarned(payload.totals.totalEarned);

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
            ? String((error as { message?: unknown }).message ?? 'Failed to fetch referral data')
            : 'Failed to fetch referral data';

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
    [addNotification, showToast]
  );

  useEffect(() => {
    void fetchWallet();
  }, [fetchWallet]);

  useVisibilityPolling(
    useCallback(() => {
      void refreshReferralData({ silent: true });
    }, [refreshReferralData]),
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

  const referralSummaryCards = useMemo(
    () => [
      { label: 'Active Referrals', value: activeReferrals.toLocaleString() },
      { label: 'Total Earned', value: `₦${totalEarned.toLocaleString()}` },
    ],
    [activeReferrals, totalEarned]
  );

  const handleCopyLink = async () => {
    if (!referralLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
      addNotification({
        kind: 'referral',
        title: 'Referral link copied',
        message: 'Your invite link is ready to share.',
      });
      showToast({ type: 'success', message: 'Referral link copied' });
      window.setTimeout(() => setCopiedLink(false), 900);
    } catch {
      showToast({ type: 'error', message: 'Failed to copy referral link' });
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

  const stats = useMemo(
    () => [
      { label: 'Friends', value: activeReferrals.toLocaleString(), currency: false },
      { label: 'Total Earned', value: totalEarned.toLocaleString(), currency: true },
      { label: 'Wallet', value: (cashBalance + bonusBalance + airtimeBalance).toLocaleString(), currency: true },
    ],
    [activeReferrals, totalEarned, cashBalance, bonusBalance, airtimeBalance]
  );

  function handleClick() {
    router.back()
  }

  return (
    <div className="min-h-screen bg-gradient-to-bl from-[#2C5364] via-[#000000] to-[#020617] pb-24 text-white">
     <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-gray-800">
        <button onClick={handleClick} className="w-10 h-10 flex items-center justify-center rounded-full cursor-pointer bg-transparent border border-white/10 shadow text-white">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="text-white font-bold text-[16px]">Profile</div>
        <button 
        onClick={(e) => {router.push('/settings')}}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white">
          <Settings className="h-7 w-7 text-current m-2" />
        </button>
      </div>

      <div className="px-4">
        <div className="rounded-[24px] border border-white/10 bg-[#0d1526]/80 px-4 py-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="flex flex-col items-center text-center">
            <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-white/5 bg-[#1b263f]">
              <Image src={user?.profilePhotoUrl || "/images/users.png"} alt="Profile avatar" width={80} height={80} className="h-full w-full object-cover" />
            </div>
            <div className="mt-4 text-[14px] font-Rubik font-bold tracking-[-0.03em]">{profileName}</div>
            <div className="mt-1 text-[12px] font-Poppins text-white/50">{user?.telegramId ? `TG ${user.telegramId}` : 'Telegram profile'}</div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {stats.map((item) => (
              <div key={item.label} className="rounded-2xl bg-[#19223a] px-2 py-4">
                <div className="text-[14px] font-Poppins text-white/80">{item.label}</div>
                <div className="mt-3 text-[16px] font-Rubik font-medium tracking-[-0.03em]">
                  {item.currency ? '₦' : ''}
                  <span className='font-bold'>
                    {item.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-white/10 bg-[#0d1526]/80 px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="text-[16px] font-bold tracking-[-0.03em] font-Rubik uppercase text-white">REFER A FRIEND & EARN REWARDS</div>
          <div className="mt-4 text-[14px] font-Poppins text-white/70">Referral Code</div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 rounded-2xl border border-white/10 bg-[#19223a] px-4 py-4 text-[14px] font-Poppins text-white/55">
              {referralCode}
            </div>
          </div>

          <div className="mt-4 text-[14px] font-Poppins text-white/70">Referral Link</div>
          <div className="mt-3 rounded-2xl border border-white/10 bg-[#19223a] px-4 py-4 text-[13px] font-Poppins text-white/70 break-all">
            {referralLink || 'Referral link unavailable'}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                void handleCopyLink();
              }}
              className={`flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#18e0a8]/40 bg-[#18e0a8]/20 text-[#03DD8D] transition hover:bg-[#18e0a8]/30 disabled:cursor-not-allowed disabled:opacity-60 ${copiedLink ? 'copied-pop' : ''}`}
              aria-label="Copy referral link"
              disabled={!referralLink}
            >
              <Copy className="h-4 w-4" />
              <span className="text-[12px] font-bold">{copiedLink ? 'Copied!' : 'Copy link'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                void handleTelegramShare();
              }}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-sky-300/35 bg-sky-400/20 text-sky-200 transition hover:bg-sky-400/30 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Share referral link on Telegram"
              disabled={!telegramShareUrl}
            >
              <Share2 className="h-4 w-4" />
              <span className="text-[12px] font-bold">Telegram</span>
            </button>
            <button
              type="button"
              onClick={() => {
                void handleWhatsAppShare();
              }}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-300/35 bg-emerald-400/20 text-emerald-200 transition hover:bg-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Share referral link on WhatsApp"
              disabled={!whatsappShareUrl}
            >
              <Share2 className="h-4 w-4" />
              <span className="text-[12px] font-bold">WhatsApp</span>
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 rounded-[24px] border border-white/10 bg-[#0d1526]/80 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          {referralSummaryCards.map((item) => (
            <div key={item.label} className="rounded-2xl bg-[#19223a] px-4 py-4">
              <div className="text-[12px] font-Poppins text-white/70">{item.label}</div>
              <div className="mt-3 text-[16px] font-bold font-Rubik tracking-[-0.03em] text-white">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-2 px-1">
          <Bell className="h-7 w-7 text-[#18e0a8]" fill="currentColor" />
          <span className="text-[20px] font-bold font-Rubik tracking-[-0.03em]">NOTIFICATIONS</span>
        </div>

        <div className="mt-4 overflow-hidden rounded-[28px] border border-white/10 bg-[#111a30] px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
          <NotificationList />
        </div>

        <div className="mt-6 flex items-center gap-2 px-1">
          <UserPlus className="h-6 w-6 text-[#18e0a8]" />
          <span className="text-[20px] font-bold font-Rubik tracking-[-0.03em]">REFERRALS</span>
        </div>

        <div className="mt-4">
          {loadingReferrals ? (
            <div className="rounded-[24px] border border-white/10 bg-[#111a30] px-4 py-6 text-sm text-white/60">
              Loading referral table...
            </div>
          ) : referralError ? (
            <div className="rounded-[24px] border border-white/10 bg-[#111a30] px-4 py-6 text-sm text-red-300">
              {referralError}
            </div>
          ) : (
            <ReferralList referrals={referrals} />
          )}
        </div>
      </div>
    </div>
  );
}
