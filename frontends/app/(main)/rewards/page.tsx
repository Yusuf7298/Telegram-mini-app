"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BellIcon, Award, Clock } from "lucide-react";
import { getTopWinners, TopWinner } from "@/lib/statsApi";
import { getDailyRewardStatus, getWinHistory, DailyRewardStatus, WinHistoryEntry } from "@/lib/rewardsApi";

export default function RewardPage() {
  const router = useRouter();
  const [dailyStatus, setDailyStatus] = useState<DailyRewardStatus | null>(null);
  const [history, setHistory] = useState<WinHistoryEntry[]>([]);
  const [winners, setWinners] = useState<TopWinner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRewardsData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [dailyRes, historyRes, winnersRes] = await Promise.all([
          getDailyRewardStatus(),
          getWinHistory(8),
          getTopWinners(6),
        ]);

        setDailyStatus(dailyRes.data.data);
        setHistory(historyRes.data.data.timeline);
        setWinners(winnersRes.data.data.winners);
      } catch {
        setDailyStatus(null);
        setHistory([]);
        setWinners([]);
        setError("Failed to load rewards data");
      } finally {
        setLoading(false);
      }
    };

    void loadRewardsData();
  }, []);

  function handleClick() {
    router.back();
  }

  return (
    <div className="min-h-screen bg-gradient-to-bl from-[#2C5364] via-[#000000] to-[#020617] pb-24">
      <div className="mb-2 flex items-center justify-between border-b border-gray-800 px-4 pb-4 pt-6">
        <button onClick={handleClick} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-transparent text-white shadow">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="text-[16px] font-bold text-white">Reward</div>
        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white">
          <BellIcon className="m-2 h-7 w-7 text-current" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-4 px-4">
          <div className="h-36 animate-pulse rounded-2xl bg-white/10" />
          <div className="h-44 animate-pulse rounded-2xl bg-white/10" />
          <div className="h-44 animate-pulse rounded-2xl bg-white/10" />
        </div>
      ) : error ? (
        <div className="px-4">
          <div className="rounded-2xl border border-white/10 bg-[#101B2A] px-4 py-5 text-sm text-red-300">{error}</div>
        </div>
      ) : (
        <>
          <div className="mx-4 mb-4 rounded-2xl border border-white/10 bg-[#16263a] p-4">
            <div className="mb-2 flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#00FFB2]" />
              <span className="font-Rubik text-[14px] font-extrabold uppercase tracking-tight text-white">Daily Reward Progress</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-[#101B2A] p-3">
                <div className="text-xs text-white/60">Streak</div>
                <div className="mt-1 text-lg font-bold text-white">{dailyStatus?.streak ?? 0}</div>
              </div>
              <div className="rounded-xl bg-[#101B2A] p-3">
                <div className="text-xs text-white/60">Next Streak</div>
                <div className="mt-1 text-lg font-bold text-white">{dailyStatus?.nextStreak ?? 0}</div>
              </div>
              <div className="rounded-xl bg-[#101B2A] p-3">
                <div className="text-xs text-white/60">Next Reward</div>
                <div className="mt-1 text-lg font-bold text-[#22d3aa]">₦{Math.max(0, dailyStatus?.nextRewardAmount ?? 0).toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="mx-4 mb-4 rounded-2xl border border-white/10 bg-[#101B2A] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Award className="h-6 w-6 text-[#00FFB2]" />
              <span className="font-Rubik text-[18px] font-extrabold uppercase tracking-tight text-white">Top Winners</span>
            </div>

            {winners.length === 0 ? (
              <div className="rounded-xl bg-white/5 px-4 py-4 text-sm text-white/70">No winner data available</div>
            ) : (
              <div className="space-y-2">
                {winners.map((winner, index) => (
                  <div key={winner.userId} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                    <div className="text-sm text-white/80">#{index + 1} {winner.username}</div>
                    <div className="text-sm font-bold text-[#22d3aa]">₦{Math.max(0, winner.totalEarnings).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mx-4 rounded-2xl border border-white/10 bg-[#101B2A] p-4">
            <div className="mb-3 font-Rubik text-[18px] font-extrabold uppercase tracking-tight text-white">Recent Rewards</div>
            {history.length === 0 ? (
              <div className="rounded-xl bg-white/5 px-4 py-4 text-sm text-white/70">No reward history yet</div>
            ) : (
              <div className="space-y-2">
                {history.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                    <div className="text-sm text-white/80">{entry.label}</div>
                    <div className="text-sm font-bold text-white">₦{Math.max(0, entry.amount).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
