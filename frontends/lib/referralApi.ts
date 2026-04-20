import api from "@/lib/apiClient";
import { ApiResponse } from './apiTypes';

export type ReferralCodeData = {
  referralCode: string;
};

export type ApplyReferralData = {
  applied: boolean;
};

export type ReferralStatus = 'PENDING' | 'JOINED' | 'ACTIVE';

export type ReferralListItem = {
  referredUserId: string;
  createdAt: string;
  user?: string;
  referralStatus: ReferralStatus;
  rewardAmount: number;
};

export type ReferralListTotals = {
  activeReferrals: number;
  totalEarned: number;
};

export type ReferralListData = {
  referrals: ReferralListItem[];
  totals: ReferralListTotals;
};

function ensureObject(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid referral API payload: ${context} must be an object`);
  }
  return value as Record<string, unknown>;
}

function ensureString(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid referral API payload: ${context} must be a non-empty string`);
  }
  return value;
}

function ensureNumber(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid referral API payload: ${context} must be a finite number`);
  }
  return value;
}

function ensureReferralStatus(value: unknown, context: string): ReferralStatus {
  if (value === 'PENDING' || value === 'JOINED' || value === 'ACTIVE') {
    return value;
  }
  throw new Error(`Invalid referral API payload: ${context} must be one of PENDING, JOINED, ACTIVE`);
}

function parseReferralListItem(value: unknown, index: number): ReferralListItem {
  const row = ensureObject(value, `referrals[${index}]`);
  const referredUserId = ensureString(row.referredUserId, `referrals[${index}].referredUserId`);
  const createdAt = ensureString(row.createdAt, `referrals[${index}].createdAt`);
  const referralStatus = ensureReferralStatus(row.referralStatus, `referrals[${index}].referralStatus`);
  const rewardAmount = ensureNumber(row.rewardAmount, `referrals[${index}].rewardAmount`);
  const parsed: ReferralListItem = {
    referredUserId,
    createdAt,
    referralStatus,
    rewardAmount,
  };

  if (row.user !== undefined) {
    parsed.user = ensureString(row.user, `referrals[${index}].user`);
  }

  return parsed;
}

function parseReferralListData(value: unknown): ReferralListData {
  const data = ensureObject(value, 'data');
  if (!Array.isArray(data.referrals)) {
    throw new Error('Invalid referral API payload: data.referrals must be an array');
  }

  const totals = ensureObject(data.totals, 'data.totals');
  return {
    referrals: data.referrals.map((row, index) => parseReferralListItem(row, index)),
    totals: {
      activeReferrals: ensureNumber(totals.activeReferrals, 'data.totals.activeReferrals'),
      totalEarned: ensureNumber(totals.totalEarned, 'data.totals.totalEarned'),
    },
  };
}

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
  return api.get<ApiResponse<ReferralListData>>("/referral/list", withTelegramHeader(initData)).then((response) => {
    response.data.data = parseReferralListData(response.data.data);
    return response;
  });
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
