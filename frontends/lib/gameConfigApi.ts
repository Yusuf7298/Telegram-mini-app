import api from "@/lib/apiClient";
import { ApiResponse } from "@/lib/apiTypes";

export type GameConfigPayload = {
  referralRewardAmount: number | string;
  freeBoxRewardAmount: number | string;
  maxReferralsPerIpPerDay: number | string;
  waitlistBonus: number | string;
};

export function getGameConfig() {
  return api.get<ApiResponse<GameConfigPayload>>("/config/game");
}
