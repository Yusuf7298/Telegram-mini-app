import { useEffect, useRef, useState } from 'react';

interface ReferralRow {
  referredUserId: string;
  user?: string;
  createdAt: string;
  status: 'PENDING' | 'JOINED' | 'ACTIVE' | 'pending' | 'joined' | 'active';
  reward: number;
}

interface ReferralListProps {
  referrals: ReferralRow[];
}

function formatMoney(amount: number) {
  return `₦${amount.toLocaleString()}`;
}

const ACTIVE_TRANSITION_MS = 2400;

type ActiveTransition = {
  fromReward: number;
  toReward: number;
  startedAt: number;
};

const statusDisplay = {
  // UI reflects backend referral lifecycle 1:1
  PENDING: {
    title: 'PENDING',
    description: 'Joined but not played',
    colorClass: 'bg-slate-400/15 text-slate-300',
  },
  JOINED: {
    title: 'JOINED',
    description: 'Waiting for play',
    colorClass: 'bg-amber-400/15 text-amber-300',
  },
  ACTIVE: {
    title: 'ACTIVE',
    description: 'Reward earned',
    colorClass: 'bg-emerald-400/15 text-emerald-300',
  },
  pending: {
    title: 'PENDING',
    description: 'Joined but not played',
    colorClass: 'bg-slate-400/15 text-slate-300',
  },
  joined: {
    title: 'JOINED',
    description: 'Waiting for play',
    colorClass: 'bg-amber-400/15 text-amber-300',
  },
  active: {
    title: 'ACTIVE',
    description: 'Reward earned',
    colorClass: 'bg-emerald-400/15 text-emerald-300',
  },
} as const;

export function ReferralList({ referrals }: ReferralListProps) {
  const [activeTransitions, setActiveTransitions] = useState<Record<string, ActiveTransition>>({});
  const [animatedRewards, setAnimatedRewards] = useState<Record<string, number>>({});

  const prevStatusByUserRef = useRef<Record<string, string>>({});
  const prevRewardByUserRef = useRef<Record<string, number>>({});
  const seenActiveTransitionRef = useRef<Record<string, boolean>>({});
  const timeoutByUserRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    referrals.forEach((referral) => {
      const userKey = referral.referredUserId;
      const currentStatus = String(referral.status).toUpperCase();
      const previousStatus = prevStatusByUserRef.current[userKey];
      const currentReward = Number(referral.reward ?? 0);
      const previousReward = prevRewardByUserRef.current[userKey] ?? 0;

      if (
        currentStatus === 'ACTIVE' &&
        previousStatus &&
        previousStatus !== 'ACTIVE' &&
        !seenActiveTransitionRef.current[userKey]
      ) {
        const transition: ActiveTransition = {
          fromReward: previousReward,
          toReward: currentReward,
          startedAt: Date.now(),
        };

        seenActiveTransitionRef.current[userKey] = true;

        setActiveTransitions((prev) => ({
          ...prev,
          [userKey]: transition,
        }));

        setAnimatedRewards((prev) => ({
          ...prev,
          [userKey]: transition.fromReward,
        }));

        const existingTimeout = timeoutByUserRef.current[userKey];
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        timeoutByUserRef.current[userKey] = setTimeout(() => {
          setActiveTransitions((prev) => {
            const next = { ...prev };
            delete next[userKey];
            return next;
          });

          setAnimatedRewards((prev) => ({
            ...prev,
            [userKey]: currentReward,
          }));

          delete timeoutByUserRef.current[userKey];
        }, ACTIVE_TRANSITION_MS + 120);
      }

      prevStatusByUserRef.current[userKey] = currentStatus;
      prevRewardByUserRef.current[userKey] = currentReward;
    });
  }, [referrals]);

  useEffect(() => {
    const entries = Object.entries(activeTransitions);
    if (entries.length === 0) {
      return;
    }

    const step = () => {
      const now = Date.now();
      let hasActiveTransitions = false;

      setAnimatedRewards((prev) => {
        const next = { ...prev };

        entries.forEach(([userKey, transition]) => {
          const elapsed = now - transition.startedAt;
          const progress = Math.min(elapsed / ACTIVE_TRANSITION_MS, 1);

          if (progress < 1) {
            hasActiveTransitions = true;
          }

          const eased = 1 - Math.pow(1 - progress, 3);
          const value = transition.fromReward + (transition.toReward - transition.fromReward) * eased;
          next[userKey] = value;
        });

        return next;
      });

      if (hasActiveTransitions) {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [activeTransitions]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      Object.values(timeoutByUserRef.current).forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
    };
  }, []);

  if (referrals.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-white/10 bg-[#111a30] px-4 py-8 text-center text-sm text-white/55">
        No referrals yet. New referrals will appear here with backend-driven status and rewards.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111a30] shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
      <table className="w-full table-fixed border-separate border-spacing-y-3 px-4 py-4">
        <colgroup>
          <col />
          <col className="w-[96px]" />
          <col className="w-[88px]" />
        </colgroup>
        <thead>
          <tr className="text-left text-[12px] font-bold uppercase tracking-[0.14em] text-white/45">
            <th className="px-0">User</th>
            <th className="px-4">Status</th>
            <th className="px-4">Reward</th>
          </tr>
        </thead>
        <tbody>
          {referrals.map((referral, index) => {
            const statusMeta = statusDisplay[referral.status];
            const userKey = referral.referredUserId;
            const userLabel = referral.user?.trim() || `User ${userKey.slice(0, 6)}`;
            const isActiveTransition = Boolean(activeTransitions[userKey]);
            const displayedReward = isActiveTransition
              ? Math.round(animatedRewards[userKey] ?? Number(referral.reward ?? 0))
              : Number(referral.reward ?? 0);

            return (
              <tr
                key={`${referral.referredUserId}-${index}`}
                className={`rounded-2xl bg-white/[0.04] text-[14px] text-white/85 ${isActiveTransition ? 'referral-active-row-glow' : ''}`}
              >
                <td className="truncate rounded-l-2xl px-4 py-4 font-semibold">{userLabel}</td>
                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1">
                    <span
                      className={`inline-flex min-w-[78px] items-center justify-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${statusMeta.colorClass}`}
                    >
                      {statusMeta.title}
                    </span>
                    <span className="text-[11px] leading-4 text-white/60">{statusMeta.description}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap rounded-r-2xl px-4 py-4 font-semibold text-[#18e0a8]">
                  <div className="flex flex-col items-start gap-1">
                    <span>{formatMoney(displayedReward)}</span>
                    {isActiveTransition ? (
                      <span className="referral-active-earned-badge rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                        🎉 +₦{Number(referral.reward ?? 0).toLocaleString()} earned
                      </span>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
