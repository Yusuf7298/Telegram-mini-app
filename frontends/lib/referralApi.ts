import api from "@/lib/apiClient";
import { ApiResponse } from './apiTypes';
import { withRequestRetry } from './requestRetry';

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
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function ensureReferralStatus(value: unknown, context: string): ReferralStatus {
  if (value === 'PENDING' || value === 'JOINED' || value === 'ACTIVE') {
    return value;
  }

  const normalized = String(value ?? '').toUpperCase();
  if (normalized === 'PENDING' || normalized === 'JOINED' || normalized === 'ACTIVE') {
    return normalized;
  }

  void context;
  return 'PENDING';
}

function parseReferralListItem(value: unknown, index: number): ReferralListItem {
  const row = ensureObject(value, `referrals[${index}]`);
  const referredUserId =
    typeof row.referredUserId === 'string' && row.referredUserId.trim().length > 0
      ? row.referredUserId
      : `unknown-${index}`;
  const createdAt =
    typeof row.createdAt === 'string' && row.createdAt.trim().length > 0
      ? row.createdAt
      : new Date(0).toISOString();
  const referralStatus = ensureReferralStatus(row.referralStatus, `referrals[${index}].referralStatus`);
  const rewardAmount = ensureNumber(row.rewardAmount, `referrals[${index}].rewardAmount`);
  const parsed: ReferralListItem = {
    referredUserId,
    createdAt,
    referralStatus,
    rewardAmount,
  };

  if (typeof row.user === 'string' && row.user.trim().length > 0) {
    parsed.user = row.user;
  }

  return parsed;
}

function parseReferralListData(value: unknown): ReferralListData {
  const data = ensureObject(value, 'data');
  const referralsSource = Array.isArray(data.referrals) ? data.referrals : [];

  const safeRows = referralsSource
    .map((row, index) => {
      try {
        return parseReferralListItem(row, index);
      } catch {
        return null;
      }
    })
    .filter((row): row is ReferralListItem => row !== null);

  const totals = ensureObject(data.totals ?? {}, 'data.totals');
  const activeReferrals = ensureNumber(totals.activeReferrals, 'data.totals.activeReferrals');
  const totalEarned = ensureNumber(totals.totalEarned, 'data.totals.totalEarned');

  if (!Array.isArray(data.referrals) || !data.totals) {
    return {
      referrals: safeRows,
      totals: {
        activeReferrals:
          Number.isFinite(activeReferrals) && activeReferrals > 0
            ? activeReferrals
            : safeRows.filter((row) => row.referralStatus === 'ACTIVE').length,
        totalEarned:
          Number.isFinite(totalEarned) && totalEarned > 0
            ? totalEarned
            : safeRows.reduce((sum, row) => sum + (Number.isFinite(row.rewardAmount) ? row.rewardAmount : 0), 0),
      },
    };
  }

  return {
    referrals: safeRows,
    totals: {
      activeReferrals,
      totalEarned,
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
  return withRequestRetry(() =>
    api.get<ApiResponse<ReferralCodeData>>("/referral/code", withTelegramHeader(initData))
  );
}

export function getReferralList(initData: string) {
  return withRequestRetry(() =>
    api.get<ApiResponse<ReferralListData>>("/referral/list", withTelegramHeader(initData))
  ).then((response) => {
    response.data.data = parseReferralListData(response.data.data);
    return response;
  });
}

export function applyReferralCode(code: string, initData: string, deviceId?: string, idempotencyKey?: string) {
  return withRequestRetry(
    () =>
      api.post<ApiResponse<ApplyReferralData>>(
        "/referral/use",
        {
          referralCode: code,
          ...(deviceId ? { deviceId } : {}),
        },
        withTelegramHeader(initData, idempotencyKey)
      ),
    {
      maxAttempts: 2,
      baseDelayMs: 250,
      maxDelayMs: 900,
    }
  );
}
