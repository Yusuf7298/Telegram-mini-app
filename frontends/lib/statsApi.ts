import api from "@/lib/apiClient";
import { ApiResponse } from "@/lib/apiTypes";

export type TopWinner = {
  userId: string;
  username: string;
  profilePhoto: string | null;
  totalEarnings: number;
  totalWins: number;
};

export type TopWinnersPayload = {
  winners: TopWinner[];
  refreshedAt: string;
};

export function getTopWinners(limit = 10) {
  return api.get<ApiResponse<TopWinnersPayload>>(`/stats/top-winners?limit=${limit}`);
}
