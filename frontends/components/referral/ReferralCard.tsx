import { useEffect, useState } from 'react';
import Image from 'next/image';
import { getGameConfig } from '@/lib/gameConfigApi';
import { useActionLock } from '@/hooks/useActionLock';
export function ReferralCard() {
  const [rewardAmount, setRewardAmount] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const actionLock = useActionLock();

  const loadRewardAmount = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getGameConfig();
      const config = response.data.data;
      const rawAmount = config?.referralRewardAmount;
      const parsedAmount = typeof rawAmount === 'number' ? rawAmount : Number(String(rawAmount ?? ''));

      if (Number.isFinite(parsedAmount) && parsedAmount > 0) {
        setRewardAmount(String(parsedAmount));
      } else {
        setRewardAmount(null);
      }
    } catch {
      setRewardAmount(null);
      setError('Could not load live referral reward.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRewardAmount();
  }, []);

  return (
    <div
      className="w-full bg-[#101B2A] rounded-2xl px-8 py-6 flex items-center justify-between"
    >
      <div className="flex flex-col flex-1 min-w-0">
        <div className="font-extrabold text-white text-[20px] leading-tight mb-2 tracking-tight">
          {loading
            ? 'Loading referral reward...'
            : `Earn ${rewardAmount ? `₦${rewardAmount}` : 'referral rewards'} per activation`}
        </div>
        <div className="text-white text-[14px] font-normal leading-snug">
          Invite your friends to play and unlock rewards from live campaign settings.
        </div>
        {error ? (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-red-300">{error}</span>
            <button
              type="button"
              onClick={() => {
                void actionLock.run('referralReward', async () => await loadRewardAmount(), { cooldownMs: 1000 }).catch(() => {});
              }}
              disabled={loading || actionLock.isLocked('referralReward')}
              className="rounded-lg border border-white/20 px-2 py-1 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-60"
            >
              Retry
            </button>
          </div>
        ) : null}
      </div>
      <div className="flex-shrink-0 ml-8">
        <Image src="/images/invite.png" alt="Invite" width={100} height={90}  />
      </div>
    </div>
  );
}
