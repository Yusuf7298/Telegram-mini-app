"use client";

import { useEffect, useState } from "react";
import { getTopWinners, TopWinner } from "@/lib/statsApi";

const rankStyles = [
  "bg-gradient-to-r from-yellow-400 to-yellow-200 text-yellow-900",
  "bg-gradient-to-r from-gray-400 to-gray-200 text-gray-900",
  "bg-gradient-to-r from-orange-400 to-orange-200 text-orange-900",
];

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<TopWinner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLeaderboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await getTopWinners(20);
        setPlayers(response.data.data.winners);
      } catch {
        setPlayers([]);
        setError("Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    };

    void loadLeaderboard();
  }, []);

  return (
    <div className="flex flex-col items-center px-4">
      <div className="mt-8 mb-4 flex w-full max-w-sm flex-col items-center rounded-2xl bg-[#101B2A] p-6 shadow-lg">
        <h1 className="mb-4 text-2xl font-bold text-white">Leaderboard</h1>

        {loading ? (
          <div className="w-full space-y-2">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={`leaderboard-skeleton-${idx}`} className="h-12 animate-pulse rounded-lg bg-white/10" />
            ))}
          </div>
        ) : error ? (
          <div className="w-full rounded-lg bg-white/10 px-3 py-4 text-sm text-red-300">{error}</div>
        ) : players.length === 0 ? (
          <div className="w-full rounded-lg bg-white/10 px-3 py-4 text-sm text-white/70">No leaderboard data available</div>
        ) : (
          <div className="w-full">
            <div className="mb-2 flex border-b border-[#232B3C] pb-2 font-bold text-gray-300">
              <div className="w-10">Rank</div>
              <div className="flex-1">Username</div>
              <div className="w-16 text-right">Wins</div>
              <div className="w-20 text-right">Earnings</div>
            </div>

            {players.map((player, i) => (
              <div
                key={player.userId}
                className={`mb-2 flex items-center rounded-lg px-2 py-2 ${i < 3 ? rankStyles[i] : "bg-[#19233A] text-white"}`}
              >
                <div className="w-10 font-bold">{i + 1}</div>
                <div className="flex-1 font-semibold">{player.username}</div>
                <div className="w-16 text-right">{player.totalWins}</div>
                <div className="w-20 text-right font-bold text-green-400">₦{Math.max(0, player.totalEarnings).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
