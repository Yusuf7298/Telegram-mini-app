"use client";

import { AnimatedCounter } from "@/components/game/AnimatedCounter";

type DailyRewardCardProps = {
  streak: number;
  nextStreak: number;
  nextRewardAmount: number;
  canClaim: boolean;
  claiming: boolean;
  onClaim: () => Promise<void>;
};

export function DailyRewardCard({
  streak,
  nextStreak,
  nextRewardAmount,
  canClaim,
  claiming,
  onClaim,
}: DailyRewardCardProps) {
  const streakDays = Array.from({ length: 7 }, (_, index) => index + 1);

  return (
    <div className="mb-5 rounded-2xl border border-white/10 bg-gradient-to-r from-[#14335e]/90 to-[#0f2341]/90 p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-white/65">Daily Reward</div>
          <div className="mt-1 text-[18px] font-black text-white">Streak Day {Math.max(streak, 0)}</div>
        </div>
        <div className="rounded-full border border-[#27d8b2]/40 bg-[#27d8b2]/15 px-3 py-1 text-[11px] font-semibold text-[#27d8b2]">
          Next: Day {nextStreak}
        </div>
      </div>

      <div className="mt-3 text-sm text-white/70">
        Claim now to receive <span className="font-bold text-[#27d8b2]">₦<AnimatedCounter value={nextRewardAmount} /></span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {streakDays.map((day) => {
          const active = day <= Math.max(streak, 0);
          const upcoming = day === Math.max(nextStreak, 1);

          return (
            <div
              key={day}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${
                active
                  ? "bg-[#1DE1B6] text-[#0b1b2f]"
                  : upcoming
                    ? "border border-[#1DE1B6]/60 bg-[#1DE1B6]/15 text-[#1DE1B6]"
                    : "bg-white/10 text-white/55"
              }`}
            >
              {day}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          void onClaim();
        }}
        disabled={!canClaim || claiming}
        className="mt-4 min-h-[46px] w-full rounded-xl bg-gradient-to-r from-[#19C37D] to-[#0FA968] px-4 py-3 text-sm font-bold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {claiming ? "Claiming..." : canClaim ? "Claim Daily Reward" : "Already Claimed Today"}
      </button>
    </div>
  );
}
