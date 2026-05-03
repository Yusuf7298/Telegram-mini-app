import api from "@/lib/apiClient";
import { ApiResponse } from "@/lib/apiTypes";
import { withRequestRetry } from "@/lib/requestRetry";

export type GameConfigPayload = {
  referralRewardAmount: number | string;
  freeBoxRewardAmount: number | string;
  maxReferralsPerIpPerDay: number | string;
  waitlistBonus: number | string;
};

export function getGameConfig() {
  return withRequestRetry(() => api.get<ApiResponse<GameConfigPayload>>("/config/game"));
}
