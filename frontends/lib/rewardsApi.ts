import api from "@/lib/apiClient";
import { ApiResponse } from "@/lib/apiTypes";

export type DailyRewardStatus = {
  canClaim: boolean;
  claimedToday: boolean;
  streak: number;
  nextStreak: number;
  nextRewardAmount: number;
  rewardTable: readonly number[];
  lastClaimAt: string | null;
  walletSnapshot?: {
    cashBalance?: number | string;
    bonusBalance?: number | string;
    airtimeBalance?: number | string;
  };
};

export type DailyRewardClaimResult = {
  rewardAmount: number;
  streak: number;
  claimedAt: string;
  isBigWin: boolean;
  rewardTable: readonly number[];
  walletSnapshot?: {
    cashBalance?: number | string;
    bonusBalance?: number | string;
    airtimeBalance?: number | string;
  };
};

export type WinHistoryEntry = {
  id: string;
  type: "box_reward" | "free_box" | "referral_reward" | "daily_reward" | "win";
  amount: number;
  createdAt: string;
  label: string;
  streak: number | null;
  isBigWin: boolean;
};

export type WinHistoryResponse = {
  timeline: WinHistoryEntry[];
  bigWinThreshold: number;
};

export function getDailyRewardStatus() {
  return api.get<ApiResponse<DailyRewardStatus>>("/rewards/daily-status");
}

export function claimDailyReward() {
  return api.post<ApiResponse<DailyRewardClaimResult>>("/rewards/daily-claim");
}

export function getWinHistory(limit = 20) {
  return api.get<ApiResponse<WinHistoryResponse>>(`/rewards/win-history?limit=${limit}`);
}
