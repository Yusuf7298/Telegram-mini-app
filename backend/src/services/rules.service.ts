import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../config/db";
import { getValidatedGameConfig } from "./gameConfig.service";

type DbClient = Prisma.TransactionClient | PrismaClient;

type PlayRuleUser = {
  isFrozen?: boolean;
  accountStatus: string;
  riskScore: number;
};

type ReferralRule = {
  status: string;
};

function resolveClient(client?: DbClient) {
  return client ?? prisma;
}

function evaluateCanUserPlayWithThreshold(user: PlayRuleUser, riskThreshold: number) {
  return !user.isFrozen && user.accountStatus === "ACTIVE" && user.riskScore <= riskThreshold;
}

export async function canUserPlay({
  user,
}: {
  user: PlayRuleUser;
  client?: DbClient;
}): Promise<boolean> {
  const config = await getValidatedGameConfig({ bypassCache: true });
  return evaluateCanUserPlayWithThreshold(user, config.withdrawRiskThreshold);
}

export function canActivateReferral(referral: ReferralRule): boolean {
  return referral.status === "JOINED";
}

export async function isCooldownActive({
  since,
  kind,
}: {
  since: Date | null;
  kind: "play_interval" | "withdraw_after_reward";
  client?: DbClient;
}): Promise<{ active: boolean; elapsedMs: number; cooldownMs: number }> {
  const config = await getValidatedGameConfig({ bypassCache: true });
  const cooldownMs = kind === "withdraw_after_reward" ? config.withdrawCooldownMs : config.minPlayIntervalMs;

  if (!since) {
    return { active: false, elapsedMs: Number.MAX_SAFE_INTEGER, cooldownMs };
  }

  const elapsedMs = Date.now() - since.getTime();
  return { active: elapsedMs < cooldownMs, elapsedMs, cooldownMs };
}

export async function canUserWithdraw({
  user,
  lastRewardAt,
}: {
  user: {
    isFrozen: boolean;
    accountStatus: string;
    riskScore: number;
    totalPlaysCount: number;
  };
  lastRewardAt: Date | null;
  client?: DbClient;
}): Promise<
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | "frozen_account_withdraw_attempt"
        | "high_risk_withdraw_attempt"
        | "minimum_play_requirement_not_met"
        | "reward_cooldown";
      requiredMinPlays?: number;
      cooldownMs?: number;
      elapsedMs?: number;
    }
> {
  const config = await getValidatedGameConfig({ bypassCache: true });

  if (user.isFrozen || user.accountStatus === "FROZEN") {
    return { allowed: false, reason: "frozen_account_withdraw_attempt" };
  }

  if (!evaluateCanUserPlayWithThreshold(user, config.withdrawRiskThreshold)) {
    return { allowed: false, reason: "high_risk_withdraw_attempt" };
  }

  if (user.totalPlaysCount < config.withdrawMinPlays) {
    return {
      allowed: false,
      reason: "minimum_play_requirement_not_met",
      requiredMinPlays: config.withdrawMinPlays,
    };
  }

  const cooldown = await isCooldownActive({
    since: lastRewardAt,
    kind: "withdraw_after_reward",
  });

  if (cooldown.active) {
    return {
      allowed: false,
      reason: "reward_cooldown",
      cooldownMs: cooldown.cooldownMs,
      elapsedMs: cooldown.elapsedMs,
    };
  }

  return { allowed: true };
}

export async function canUseReferral({
  ip,
  deviceId,
  referrerId,
  referredId,
  client,
}: {
  ip: string;
  deviceId?: string;
  referrerId?: string;
  referredId?: string;
  client?: DbClient;
}): Promise<boolean> {
  const resolvedClient = resolveClient(client);
  const config = await getValidatedGameConfig({ bypassCache: true });
  const since = new Date(Date.now() - config.referralWindowMs);

  const countByIp = await resolvedClient.referralLog.count({
    where: {
      ip,
      createdAt: { gte: since },
    },
  });

  if (countByIp >= config.maxReferralsPerIpPerDay) {
    return false;
  }

  if (referrerId && referredId) {
    const [referrer, referred] = await Promise.all([
      resolvedClient.user.findUnique({ where: { id: referrerId }, select: { deviceHash: true, createdIp: true } }),
      resolvedClient.user.findUnique({ where: { id: referredId }, select: { deviceHash: true, createdIp: true } }),
    ]);

    if (!referrer || !referred) return false;
    if (referrer.createdIp === referred.createdIp) return false;
    if (referrer.deviceHash && referred.deviceHash && referrer.deviceHash === referred.deviceHash) {
      return false;
    }
  }

  if (deviceId) {
    const countByDevice = await resolvedClient.referralLog.count({
      where: {
        deviceId,
        createdAt: { gte: since },
      },
    });
    if (countByDevice >= config.maxReferralsPerIpPerDay) {
      return false;
    }
  }

  return true;
}

export async function canUnlockWaitlistBonus({
  user,
}: {
  user: {
    totalPlaysCount: number;
    waitlistBonusUnlocked: boolean;
    waitlistBonusEligible: boolean;
    accountStatus: string;
    riskScore: number;
  };
}): Promise<boolean> {
  const config = await getValidatedGameConfig({ bypassCache: true });
  const canUnlockBonus =
    user.waitlistBonusEligible &&
    user.accountStatus === "ACTIVE" &&
    user.riskScore <= config.waitlistRiskThreshold;

  return user.totalPlaysCount >= config.maxPlaysPerDay && !user.waitlistBonusUnlocked && canUnlockBonus;
}

export async function isRapidOnboardingCompletion(playTimestampsMs: number[]): Promise<boolean> {
  const config = await getValidatedGameConfig({ bypassCache: true });
  if (playTimestampsMs.length < config.maxPlaysPerDay) {
    return false;
  }

  const newest = playTimestampsMs[0];
  const oldest = playTimestampsMs[playTimestampsMs.length - 1];
  return newest - oldest <= config.rapidOnboardingWindowMs;
}

export function shouldEvaluateReferralOnPlay(totalPlaysBefore: number, referredById: string | null): boolean {
  return totalPlaysBefore === 0 && !!referredById;
}
