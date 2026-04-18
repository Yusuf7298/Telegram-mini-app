import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";

type GameConfigRow = {
  id: string;
  rtpModifier: number;
  maxPayoutMultiplier: Prisma.Decimal;
  minRtpModifier: Prisma.Decimal;
  maxRtpModifier: Prisma.Decimal;
  referralRewardAmount: Prisma.Decimal;
  freeBoxRewardAmount: Prisma.Decimal;
  minBoxReward: number;
  maxBoxReward: number;
  waitlistBonus: number;
  maxPlaysPerDay: number;
  withdrawMinPlays: number;
  withdrawCooldownMs: number;
  withdrawRiskThreshold: number;
  maxReferralsPerIpPerDay: number;
  waitlistRiskThreshold: number;
  rapidOnboardingWindowMs: number;
  minPlayIntervalMs: number;
  referralWindowMs: number;
  dailyRewardTable: string;
  dailyRewardBigWinThreshold: number;
  winHistoryBigWinThreshold: number;
};

const GAME_CONFIG_ID = "global";

function toFiniteNumber(value: unknown, fieldName: string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  throw new Error(`CRITICAL: GameConfig.${fieldName} is not a finite number`);
}

function validateGameConfigOrThrow(config: GameConfigRow): GameConfigRow {
  const minBoxReward = toFiniteNumber(config.minBoxReward, "minBoxReward");
  const maxBoxReward = toFiniteNumber(config.maxBoxReward, "maxBoxReward");
  const maxPayoutMultiplier = config.maxPayoutMultiplier.toNumber();
  const minRtpModifier = config.minRtpModifier.toNumber();
  const maxRtpModifier = config.maxRtpModifier.toNumber();
  const rtpModifier = toFiniteNumber(config.rtpModifier, "rtpModifier");
  const referralRewardAmount = config.referralRewardAmount.toNumber();
  const waitlistBonus = toFiniteNumber(config.waitlistBonus, "waitlistBonus");
  const maxPlaysPerDay = toFiniteNumber(config.maxPlaysPerDay, "maxPlaysPerDay");
  const withdrawMinPlays = toFiniteNumber(config.withdrawMinPlays, "withdrawMinPlays");
  const withdrawCooldownMs = toFiniteNumber(config.withdrawCooldownMs, "withdrawCooldownMs");
  const withdrawRiskThreshold = toFiniteNumber(config.withdrawRiskThreshold, "withdrawRiskThreshold");
  const maxReferralsPerIpPerDay = toFiniteNumber(config.maxReferralsPerIpPerDay, "maxReferralsPerIpPerDay");
  const waitlistRiskThreshold = toFiniteNumber(config.waitlistRiskThreshold, "waitlistRiskThreshold");
  const rapidOnboardingWindowMs = toFiniteNumber(config.rapidOnboardingWindowMs, "rapidOnboardingWindowMs");
  const minPlayIntervalMs = toFiniteNumber(config.minPlayIntervalMs, "minPlayIntervalMs");
  const referralWindowMs = toFiniteNumber(config.referralWindowMs, "referralWindowMs");

  if (!(minBoxReward < maxBoxReward)) {
    throw new Error("CRITICAL: Invalid GameConfig: minBoxReward must be less than maxBoxReward");
  }

  if (!(referralRewardAmount > 0)) {
    throw new Error("CRITICAL: Invalid GameConfig: referralRewardAmount must be greater than 0");
  }

  if (!(maxPayoutMultiplier > 0)) {
    throw new Error("CRITICAL: Invalid GameConfig: maxPayoutMultiplier must be greater than 0");
  }

  if (!(minRtpModifier > 0)) {
    throw new Error("CRITICAL: Invalid GameConfig: minRtpModifier must be greater than 0");
  }

  if (!(maxRtpModifier > 0)) {
    throw new Error("CRITICAL: Invalid GameConfig: maxRtpModifier must be greater than 0");
  }

  if (!(minRtpModifier <= maxRtpModifier)) {
    throw new Error("CRITICAL: Invalid GameConfig: minRtpModifier must be less than or equal to maxRtpModifier");
  }

  if (!(rtpModifier >= minRtpModifier && rtpModifier <= maxRtpModifier)) {
    throw new Error("CRITICAL: Invalid GameConfig: rtpModifier must be within [minRtpModifier, maxRtpModifier]");
  }

  if (waitlistBonus < 0) {
    throw new Error("CRITICAL: Invalid GameConfig: waitlistBonus must be greater than or equal to 0");
  }

  if (maxPlaysPerDay <= 0) {
    throw new Error("CRITICAL: Invalid GameConfig: maxPlaysPerDay must be greater than 0");
  }

  if (withdrawMinPlays <= 0) {
    throw new Error("CRITICAL: Invalid GameConfig: withdrawMinPlays must be greater than 0");
  }

  if (withdrawCooldownMs <= 0) {
    throw new Error("CRITICAL: Invalid GameConfig: withdrawCooldownMs must be greater than 0");
  }

  if (withdrawRiskThreshold < 0) {
    throw new Error("CRITICAL: Invalid GameConfig: withdrawRiskThreshold must be greater than or equal to 0");
  }

  if (maxReferralsPerIpPerDay <= 0) {
    throw new Error("CRITICAL: Invalid GameConfig: maxReferralsPerIpPerDay must be greater than 0");
  }

  if (waitlistRiskThreshold < 0) {
    throw new Error("CRITICAL: Invalid GameConfig: waitlistRiskThreshold must be greater than or equal to 0");
  }

  if (rapidOnboardingWindowMs <= 0) {
    throw new Error("CRITICAL: Invalid GameConfig: rapidOnboardingWindowMs must be greater than 0");
  }

  if (minPlayIntervalMs <= 0) {
    throw new Error("CRITICAL: Invalid GameConfig: minPlayIntervalMs must be greater than 0");
  }

  if (referralWindowMs <= 0) {
    throw new Error("CRITICAL: Invalid GameConfig: referralWindowMs must be greater than 0");
  }

  return config;
}

async function fetchRawGameConfig(): Promise<GameConfigRow> {
  const config = await prisma.gameConfig.findFirst({
    where: { id: GAME_CONFIG_ID },
    select: {
      id: true,
      rtpModifier: true,
      maxPayoutMultiplier: true,
      minRtpModifier: true,
      maxRtpModifier: true,
      referralRewardAmount: true,
      freeBoxRewardAmount: true,
      minBoxReward: true,
      maxBoxReward: true,
      waitlistBonus: true,
      maxPlaysPerDay: true,
      withdrawMinPlays: true,
      withdrawCooldownMs: true,
      withdrawRiskThreshold: true,
      maxReferralsPerIpPerDay: true,
      waitlistRiskThreshold: true,
      rapidOnboardingWindowMs: true,
      minPlayIntervalMs: true,
      referralWindowMs: true,
      dailyRewardTable: true,
      dailyRewardBigWinThreshold: true,
      winHistoryBigWinThreshold: true,
    },
  });

  if (!config) {
    throw new Error("CRITICAL: GameConfig row is missing. Refusing to continue.");
  }

  return config as GameConfigRow;
}

export function invalidateGameConfigCache() {
  // No-op by design: strict mode reads validated config fresh each time.
}

export async function getValidatedGameConfig(options: {
  bypassCache: true;
}): Promise<GameConfigRow> {
  if (!options?.bypassCache) {
    throw new Error("CRITICAL: getValidatedGameConfig must be called with { bypassCache: true }");
  }

  return validateGameConfigOrThrow(await fetchRawGameConfig());
}

export async function assertGameConfigOnStartup() {
  const config = await getValidatedGameConfig({ bypassCache: true });
  if (!config) {
    throw new Error("CRITICAL: GameConfig is missing. Refusing to boot.");
  }
}

export { validateGameConfigOrThrow };