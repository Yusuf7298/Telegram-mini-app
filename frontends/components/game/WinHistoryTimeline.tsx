"use client";

import { Gift, Sparkles, Star } from "lucide-react";
import { WinHistoryEntry } from "@/lib/rewardsApi";

type WinHistoryTimelineProps = {
  entries: WinHistoryEntry[];
  loading: boolean;
};

function getIcon(type: WinHistoryEntry["type"]) {
  if (type === "daily_reward") return <Star className="h-4 w-4" />;
  if (type === "referral_reward") return <Sparkles className="h-4 w-4" />;
  return <Gift className="h-4 w-4" />;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WinHistoryTimeline({ entries, loading }: WinHistoryTimelineProps) {
  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-[#0f1a2d]/85 p-4 shadow-lg">
      <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/60">Win History</div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-14 animate-pulse rounded-xl bg-white/10" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/60">
          No wins yet. Open a box to start your timeline.
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${entry.isBigWin ? "bg-yellow-400/25 text-yellow-300" : "bg-emerald-400/20 text-emerald-300"}`}>
                {getIcon(entry.type)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{entry.label}</div>
                <div className="text-[12px] text-white/60">{formatDate(entry.createdAt)}</div>
              </div>

              <div className="text-right">
                <div className={`text-sm font-extrabold ${entry.isBigWin ? "text-yellow-300" : "text-[#1DE1B6]"}`}>
                  +₦{Math.max(0, entry.amount).toLocaleString()}
                </div>
                {typeof entry.streak === "number" ? (
                  <div className="text-[11px] text-white/55">Streak {entry.streak}</div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
