import api from "@/lib/apiClient";
import { ApiResponse } from './apiTypes';

export type ReferralCodeData = {
  referralCode: string;
};

export type ApplyReferralData = {
  applied: boolean;
};

export type ReferralStatus = 'PENDING' | 'JOINED' | 'ACTIVE' | 'pending' | 'joined' | 'active';

export type ReferralListItem = {
  referredUserId: string;
  createdAt: string;
  user?: string;
  status: ReferralStatus;
  reward: number;
};

export type ReferralListTotals = {
  activeReferrals: number;
  totalEarned: number;
};

export type ReferralListData = {
  referrals: ReferralListItem[];
  totals: ReferralListTotals;
};

type TelegramHeaderConfig = {
  headers: {
    "x-telegram-initdata": string;
    "x-idempotency-key"?: string;
  };
};

function withTelegramHeader(initData: string, idempotencyKey?: string): TelegramHeaderConfig {
  return {
    headers: {
      "x-telegram-initdata": initData,
      ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
    },
  };
}

export function getReferralCode(initData: string) {
  return api.get<ApiResponse<ReferralCodeData>>("/referral/code", withTelegramHeader(initData));
}

export function getReferralList(initData: string) {
  return api.get<ApiResponse<ReferralListData>>("/referral/list", withTelegramHeader(initData));
}

export function applyReferralCode(code: string, initData: string, deviceId?: string, idempotencyKey?: string) {
  return api.post<ApiResponse<ApplyReferralData>>(
    "/referral/use",
    {
      referralCode: code,
      ...(deviceId ? { deviceId } : {}),
    },
    withTelegramHeader(initData, idempotencyKey)
  );
}
