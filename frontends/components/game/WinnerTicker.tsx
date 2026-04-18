"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getTopWinners, TopWinner } from "@/lib/statsApi";

function getInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return "?";
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function WinnerTicker() {
  const [winners, setWinners] = useState<TopWinner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadWinners = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await getTopWinners(4);
        setWinners(response.data.data.winners);
      } catch {
        setWinners([]);
        setError("Failed to load winners");
      } finally {
        setLoading(false);
      }
    };

    void loadWinners();
  }, []);

  if (loading) {
    return (
      <div className="mt-2 grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={`winner-skeleton-${idx}`} className="h-16 animate-pulse rounded-xl bg-white/10" />
        ))}
      </div>
    );
  }

  if (error || winners.length === 0) {
    return <div className="mt-2 text-center text-xs text-white/70">No winners yet</div>;
  }

  return (
    <div className="flex justify-center gap-2 mt-2">
      {winners.map((winner, idx) => (
        <div key={winner.userId || idx} className="flex flex-col items-center">
          {winner.profilePhoto ? (
            <Image
              src={winner.profilePhoto}
              alt={winner.username}
              className="w-14 h-14 rounded-full object-cover border-2 border-[#222] mb-1"
              style={{ background: "#222" }}
              width={56}
              height={56}
            />
          ) : (
            <div className="w-14 h-14 rounded-full border-2 border-[#222] mb-1 bg-[#222] text-white flex items-center justify-center text-xs font-bold">
              {getInitials(winner.username)}
            </div>
          )}
          <div className="text-white text-xs font-medium text-center whitespace-nowrap">
            {winner.username} <span className="font-normal">won ₦{Math.max(0, winner.totalEarnings).toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
