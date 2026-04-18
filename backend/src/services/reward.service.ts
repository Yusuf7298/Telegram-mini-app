import { Prisma } from "@prisma/client";
import crypto from "crypto";

export type RewardConfig = {
  rtpModifier: number;
  maxPayoutMultiplier: Prisma.Decimal;
  minRtpModifier: Prisma.Decimal;
  maxRtpModifier: Prisma.Decimal;
  referralRewardAmount: Prisma.Decimal;
  minBoxReward: number;
  maxBoxReward: number;
};

export type RewardContext =
  | {
      kind: "open_box";
      boxPrice: Prisma.Decimal;
      isOnboarding: boolean;
    }
  | {
      kind: "free_box";
    }
  | {
      kind: "referral_activation";
    };

function applyOnboardingRtpControl(
  reward: Prisma.Decimal,
  boxPrice: Prisma.Decimal,
  onboardingRtpModifier: number,
  maxPayoutMultiplier: Prisma.Decimal
): Prisma.Decimal {
  const factor = new Prisma.Decimal(onboardingRtpModifier);
  const maxSafeReward = boxPrice.mul(maxPayoutMultiplier);
  const adjusted = reward.mul(factor);
  return adjusted.gt(maxSafeReward) ? maxSafeReward : adjusted;
}

export function generateReward(config: RewardConfig, context: RewardContext): Prisma.Decimal {
  if (context.kind === "referral_activation") {
    return config.referralRewardAmount;
  }

  const rolledReward = new Prisma.Decimal(crypto.randomInt(config.minBoxReward, config.maxBoxReward));

  if (context.kind === "open_box" && context.isOnboarding) {
    const onboardingFactor = Math.max(
      config.minRtpModifier.toNumber(),
      Math.min(config.rtpModifier, config.maxRtpModifier.toNumber())
    );

    return applyOnboardingRtpControl(
      rolledReward,
      context.boxPrice,
      onboardingFactor,
      config.maxPayoutMultiplier
    );
  }

  return rolledReward;
}
