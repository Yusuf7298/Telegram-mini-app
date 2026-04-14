import { Prisma } from "@prisma/client";

type TimestampedAmount = {
  at: number;
  amount: number;
};

type UserFraudState = {
  openBoxCalls: number[];
  rewardEvents: TimestampedAmount[];
  withdrawAttempts: number[];
};

export type FraudDetectionResult = {
  isSuspicious: boolean;
  reason?: string;
};

const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const OPEN_BOX_LIMIT_PER_MINUTE = 20;
const WITHDRAW_ATTEMPT_LIMIT = 3;
const WITHDRAW_SHORT_WINDOW_MS = 30 * 1000;

const userFraudState = new Map<string, UserFraudState>();

function toNumber(value: Prisma.Decimal | string | number | null | undefined): number {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function getUserState(userId: string): UserFraudState {
  const existing = userFraudState.get(userId);
  if (existing) {
    return existing;
  }

  const nextState: UserFraudState = {
    openBoxCalls: [],
    rewardEvents: [],
    withdrawAttempts: [],
  };
  userFraudState.set(userId, nextState);
  return nextState;
}

function pruneState(state: UserFraudState, now: number) {
  state.openBoxCalls = state.openBoxCalls.filter((timestamp) => now - timestamp <= ONE_MINUTE_MS);
  state.rewardEvents = state.rewardEvents.filter((event) => now - event.at <= ONE_HOUR_MS);
  state.withdrawAttempts = state.withdrawAttempts.filter((timestamp) => now - timestamp <= WITHDRAW_SHORT_WINDOW_MS);
}

export function recordBoxOpenAttempt(userId: string): FraudDetectionResult {
  const now = Date.now();
  const state = getUserState(userId);
  pruneState(state, now);

  state.openBoxCalls.push(now);

  if (state.openBoxCalls.length > OPEN_BOX_LIMIT_PER_MINUTE) {
    return {
      isSuspicious: true,
      reason: "box_open_rate_high",
    };
  }

  return { isSuspicious: false };
}

export function recordRewardEvent(userId: string, rewardAmount: Prisma.Decimal | string | number): FraudDetectionResult {
  const now = Date.now();
  const state = getUserState(userId);
  pruneState(state, now);

  const amount = toNumber(rewardAmount);
  const rewardSnapshot = { at: now, amount };
  const averageReward =
    state.rewardEvents.length === 0
      ? amount
      : state.rewardEvents.reduce((sum, event) => sum + event.amount, 0) / state.rewardEvents.length;

  state.rewardEvents.push(rewardSnapshot);

  if (state.rewardEvents.length > 1 && averageReward > 0 && amount > averageReward * 5) {
    return {
      isSuspicious: true,
      reason: "reward_spike_detected",
    };
  }

  return { isSuspicious: false };
}

export function recordWithdrawAttempt(userId: string): FraudDetectionResult {
  const now = Date.now();
  const state = getUserState(userId);
  pruneState(state, now);

  state.withdrawAttempts.push(now);

  if (state.withdrawAttempts.length >= WITHDRAW_ATTEMPT_LIMIT) {
    return {
      isSuspicious: true,
      reason: "withdraw_frequency_high",
    };
  }

  return { isSuspicious: false };
}
