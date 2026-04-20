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

type ReferralFraudState = {
  inviterRewardEvents: number[];
  inviterActivationEvents: number[];
  ipReferralEvents: number[];
  deviceJoinedEvents: number[];
};

export type ReferralAnomalyResult = {
  isAnomalous: boolean;
  pattern?: string;
  count: number;
  timeframeMs: number;
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
const REFERRAL_REWARD_BURST_WINDOW_MS = 5 * 60 * 1000;
const REFERRAL_REWARD_BURST_LIMIT = 5;
const REFERRAL_IP_WINDOW_MS = 10 * 60 * 1000;
const REFERRAL_IP_LIMIT = 8;
const REFERRAL_DEVICE_JOINED_WINDOW_MS = 10 * 60 * 1000;
const REFERRAL_DEVICE_JOINED_LIMIT = 4;
const REFERRAL_ACTIVATION_BURST_WINDOW_MS = 5 * 60 * 1000;
const REFERRAL_ACTIVATION_BURST_LIMIT = 5;

const userFraudState = new Map<string, UserFraudState>();
const inviterReferralState = new Map<string, ReferralFraudState>();
const ipReferralState = new Map<string, ReferralFraudState>();
const deviceReferralState = new Map<string, ReferralFraudState>();

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

function getReferralState(map: Map<string, ReferralFraudState>, key: string): ReferralFraudState {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }

  const nextState: ReferralFraudState = {
    inviterRewardEvents: [],
    inviterActivationEvents: [],
    ipReferralEvents: [],
    deviceJoinedEvents: [],
  };

  map.set(key, nextState);
  return nextState;
}

function pruneTimestamps(timestamps: number[], now: number, windowMs: number): number[] {
  return timestamps.filter((timestamp) => now - timestamp <= windowMs);
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

export function recordReferralRewardForInviter(inviterId: string): ReferralAnomalyResult {
  const now = Date.now();
  const state = getReferralState(inviterReferralState, inviterId);
  state.inviterRewardEvents = pruneTimestamps(state.inviterRewardEvents, now, REFERRAL_REWARD_BURST_WINDOW_MS);
  state.inviterRewardEvents.push(now);

  const count = state.inviterRewardEvents.length;
  if (count > REFERRAL_REWARD_BURST_LIMIT) {
    return {
      isAnomalous: true,
      pattern: "inviter_reward_burst",
      count,
      timeframeMs: REFERRAL_REWARD_BURST_WINDOW_MS,
    };
  }

  return {
    isAnomalous: false,
    count,
    timeframeMs: REFERRAL_REWARD_BURST_WINDOW_MS,
  };
}

export function recordReferralActivationForInviter(inviterId: string): ReferralAnomalyResult {
  const now = Date.now();
  const state = getReferralState(inviterReferralState, inviterId);
  state.inviterActivationEvents = pruneTimestamps(state.inviterActivationEvents, now, REFERRAL_ACTIVATION_BURST_WINDOW_MS);
  state.inviterActivationEvents.push(now);

  const count = state.inviterActivationEvents.length;
  if (count > REFERRAL_ACTIVATION_BURST_LIMIT) {
    return {
      isAnomalous: true,
      pattern: "activation_burst",
      count,
      timeframeMs: REFERRAL_ACTIVATION_BURST_WINDOW_MS,
    };
  }

  return {
    isAnomalous: false,
    count,
    timeframeMs: REFERRAL_ACTIVATION_BURST_WINDOW_MS,
  };
}

export function recordReferralByIp(ip: string): ReferralAnomalyResult {
  const now = Date.now();
  const state = getReferralState(ipReferralState, ip);
  state.ipReferralEvents = pruneTimestamps(state.ipReferralEvents, now, REFERRAL_IP_WINDOW_MS);
  state.ipReferralEvents.push(now);

  const count = state.ipReferralEvents.length;
  if (count > REFERRAL_IP_LIMIT) {
    return {
      isAnomalous: true,
      pattern: "ip_referral_burst",
      count,
      timeframeMs: REFERRAL_IP_WINDOW_MS,
    };
  }

  return {
    isAnomalous: false,
    count,
    timeframeMs: REFERRAL_IP_WINDOW_MS,
  };
}

export function recordReferralJoinedByDevice(deviceId: string): ReferralAnomalyResult {
  const now = Date.now();
  const state = getReferralState(deviceReferralState, deviceId);
  state.deviceJoinedEvents = pruneTimestamps(state.deviceJoinedEvents, now, REFERRAL_DEVICE_JOINED_WINDOW_MS);
  state.deviceJoinedEvents.push(now);

  const count = state.deviceJoinedEvents.length;
  if (count > REFERRAL_DEVICE_JOINED_LIMIT) {
    return {
      isAnomalous: true,
      pattern: "device_joined_burst",
      count,
      timeframeMs: REFERRAL_DEVICE_JOINED_WINDOW_MS,
    };
  }

  return {
    isAnomalous: false,
    count,
    timeframeMs: REFERRAL_DEVICE_JOINED_WINDOW_MS,
  };
}
