import { prisma } from "../../config/db";
import { Prisma } from "@prisma/client";
import { withTransactionRetry } from "../../services/withTransactionRetry";
import { withUserLock } from "../../utils/lock";
import { logSuspiciousAction } from "../../services/suspiciousActionLog.service";
import { logAudit } from "../../services/auditLog.service";
import { logStructuredEvent } from "../../services/logger";
import { recordBoxOpenAttempt, recordRewardEvent } from "../../services/fraudDetection.service";
import { createIdempotencyKey, completeIdempotencyKey, checkIdempotencyKey } from "../../services/idempotency.service";
import { canActivateReferral } from "../../services/rules.service";
import { trackBonusUsage } from "../../services/bonus.service";
import { logReferral, checkReferralLimits } from "../../services/referral.service";
import { adjustRewardProbabilities } from "../../services/rtp.service";
import { getValidatedGameConfig } from "../../services/gameConfig.service";
import {
  canUserPlay,
  isCooldownActive,
  canUnlockWaitlistBonus,
  isRapidOnboardingCompletion,
  shouldEvaluateReferralOnPlay,
} from "../../services/rules.service";
import { generateReward, RewardContext } from "../../services/reward.service";
import { NEGATIVE_ONE, ONE, ZERO } from "../../constants/numbers";

async function unlockWaitlistBonusIfEligible(tx: Prisma.TransactionClient, userId: string) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      totalPlaysCount: true,
      waitlistBonusUnlocked: true,
      waitlistBonusEligible: true,
      accountStatus: true,
      riskScore: true,
    },
  });

  if (!user) return;

  const shouldUnlock = await canUnlockWaitlistBonus({
    user: {
      totalPlaysCount: user.totalPlaysCount,
      waitlistBonusUnlocked: user.waitlistBonusUnlocked,
      waitlistBonusEligible: user.waitlistBonusEligible,
      accountStatus: user.accountStatus,
      riskScore: user.riskScore,
    },
  });

  if (shouldUnlock) {
    await tx.user.update({
      where: { id: userId },
      data: {
        waitlistBonusUnlocked: true,
        welcomeBonusUnlocked: true,
      },
    });

    await tx.wallet.update({
      where: { userId },
      data: { bonusLocked: false },
    });
  }
}

async function detectRapidOnboardingCompletion(tx: Prisma.TransactionClient, userId: string) {
  const config = await getGameConfig(tx);
  const lastFivePlayTransactions = await tx.transaction.findMany({
    where: {
      userId,
      type: { in: ["BOX_PURCHASE", "FREE_BOX"] },
    },
    orderBy: { createdAt: "desc" },
    take: config.maxPlaysPerDay,
    select: { createdAt: true },
  });

  const playTimestampsMs = lastFivePlayTransactions.map((row) => row.createdAt.getTime());
  const isRapid = await isRapidOnboardingCompletion(playTimestampsMs);
  if (isRapid) {
    const newest = playTimestampsMs[ZERO];
    const oldest = playTimestampsMs[playTimestampsMs.length + NEGATIVE_ONE];
    await tx.user.update({
      where: { id: userId },
      data: {
        waitlistBonusEligible: false,
      },
    });

    await tx.wallet.update({
      where: { userId },
      data: { bonusLocked: true },
    });

    await logSuspiciousAction({
      userId,
      type: "onboarding_abuse",
      metadata: { playCount: config.maxPlaysPerDay, durationMs: newest - oldest },
      tx,
    });
  }
}

async function enforceGameplayPacing(
  tx: Prisma.TransactionClient,
  user: { id: string; lastPlayTimestamp: Date | null },
  action: "openBox" | "openFreeBox"
) {
  const cooldown = await isCooldownActive({
    since: user.lastPlayTimestamp,
    kind: "play_interval",
    client: tx,
  });

  if (cooldown.active) {
    await logSuspiciousAction({
      userId: user.id,
      type: "rapid_play",
      metadata: { action, elapsedMs: cooldown.elapsedMs, minIntervalMs: cooldown.cooldownMs },
      tx,
    });
  }
}

async function getGameConfig(tx: Prisma.TransactionClient) {
  const config = await getValidatedGameConfig({ bypassCache: true });
  return {
    rtpModifier: config.rtpModifier,
    maxPayoutMultiplier: config.maxPayoutMultiplier,
    minRtpModifier: config.minRtpModifier,
    maxRtpModifier: config.maxRtpModifier,
    referralRewardAmount: config.referralRewardAmount,
    freeBoxRewardAmount: config.freeBoxRewardAmount,
    minBoxReward: config.minBoxReward,
    maxBoxReward: config.maxBoxReward,
    waitlistBonus: config.waitlistBonus,
    maxPlaysPerDay: config.maxPlaysPerDay,
    withdrawRiskThreshold: config.withdrawRiskThreshold,
    waitlistRiskThreshold: config.waitlistRiskThreshold,
    rapidOnboardingWindowMs: config.rapidOnboardingWindowMs,
    minPlayIntervalMs: config.minPlayIntervalMs,
  };
}


export async function openBox(
  userId: string,
  boxId: string,
  idempotencyKey: string,
  ip?: string,
  deviceId?: string
) {
  return withUserLock(userId, async () => {
    return withTransactionRetry(prisma, async (tx) => {
      await logStructuredEvent("financial_operation", {
        userId,
        action: "open_box_attempt",
        reward: null,
        idempotencyKey,
        timestamp: new Date().toISOString(),
      });

      const existing = await checkIdempotencyKey({ id: idempotencyKey, userId, tx });
      if (existing?.status === "COMPLETED") {
        await logStructuredEvent("financial_operation", {
          userId,
          action: "idempotency_replay",
          reward: (existing.response as Record<string, any> | null)?.data?.reward ?? null,
          idempotencyKey,
          timestamp: new Date().toISOString(),
        });
        return existing.response;
      }
      if (existing?.status === "PENDING") {
        throw new Error("Idempotent request is still processing");
      }

      try {
        await createIdempotencyKey({ id: idempotencyKey, userId, action: "openBox", tx });
      } catch (err) {
        const duplicate = await checkIdempotencyKey({ id: idempotencyKey, userId, tx });
        if (duplicate?.status === "COMPLETED") {
          return duplicate.response;
        }
        if (duplicate?.status === "PENDING") {
          throw new Error("Idempotent request is still processing");
        }
        throw err;
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          isFrozen: true,
          accountStatus: true,
          riskScore: true,
          totalPlaysCount: true,
          referredById: true,
          lastPlayTimestamp: true,
        },
      });

      if (!user) throw new Error("User not found");
      const config = await getGameConfig(tx);
      const playAllowed = await canUserPlay({
        user: {
          isFrozen: user.isFrozen,
          accountStatus: user.accountStatus,
          riskScore: user.riskScore,
        },
        client: tx,
      });
      if (!playAllowed) {
        throw new Error("Account restricted");
      }

      await enforceGameplayPacing(tx, { id: user.id, lastPlayTimestamp: user.lastPlayTimestamp }, "openBox");

      const isOnboarding = user.totalPlaysCount < config.maxPlaysPerDay;

      await tx.boxOpenLog.create({
        data: { userId, ip: ip || "", deviceId, action: "openBox" },
      });

      const box = await tx.box.findUnique({ where: { id: boxId } });
      if (!box) throw new Error("Box not found");

      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new Error("Wallet not found");

      const availableBonus = wallet.bonusLocked ? new Prisma.Decimal(ZERO) : wallet.bonusBalance;
      const spendableTotal = wallet.cashBalance.plus(availableBonus);
      const totalBeforePurchase = wallet.cashBalance.plus(wallet.bonusBalance);
      if (spendableTotal.lt(box.price)) {
        throw new Error("Insufficient balance");
      }

      let cashUsed = new Prisma.Decimal(ZERO);
      let bonusUsed = new Prisma.Decimal(ZERO);

      if (availableBonus.gte(box.price)) {
        bonusUsed = box.price;
      } else if (wallet.cashBalance.gte(box.price)) {
        cashUsed = box.price;
      } else {
        bonusUsed = availableBonus;
        cashUsed = box.price.minus(bonusUsed);
      }

      const nextCashBalance = wallet.cashBalance.minus(cashUsed);
      const nextBonusBalance = wallet.bonusBalance.minus(bonusUsed);

      await logStructuredEvent("financial_operation", {
        userId,
        action: "box_purchase_mutation_before",
        amount: box.price.toString(),
        idempotencyKey,
        timestamp: new Date().toISOString(),
      });

      const deductResult = await tx.wallet.updateMany({
        where: {
          userId,
          cashBalance: wallet.cashBalance,
          bonusBalance: wallet.bonusBalance,
        },
        data: {
          cashBalance: nextCashBalance,
          bonusBalance: nextBonusBalance,
        },
      });

      await logStructuredEvent("financial_operation", {
        userId,
        action: "box_purchase_mutation_after",
        amount: box.price.toString(),
        idempotencyKey,
        timestamp: new Date().toISOString(),
      });

      if (deductResult.count === ZERO) {
        throw new Error("Balance changed, please retry");
      }

      const walletAfterDeduct = await tx.wallet.findUnique({ where: { userId } });
      if (!walletAfterDeduct) throw new Error("Wallet not found");

      await tx.transaction.create({
        data: {
          userId,
          boxId,
          type: "BOX_PURCHASE",
          amount: box.price.neg(),
          balanceBefore: totalBeforePurchase,
          balanceAfter: walletAfterDeduct.cashBalance.plus(walletAfterDeduct.bonusBalance),
          meta: { cashUsed: cashUsed.toString(), bonusUsed: bonusUsed.toString(), bonusLocked: wallet.bonusLocked },
        },
      });

      const context: RewardContext = {
        kind: "open_box",
        boxPrice: box.price,
        isOnboarding,
      };
      const reward = generateReward(config, context);

      if (!isOnboarding) {
        await adjustRewardProbabilities(false);
      }

      await logStructuredEvent("financial_operation", {
        userId,
        action: "box_reward_mutation_before",
        reward: reward.toString(),
        idempotencyKey,
        timestamp: new Date().toISOString(),
      });

      const openBoxSuspicion = recordBoxOpenAttempt(userId);
      if (openBoxSuspicion.isSuspicious) {
        await logStructuredEvent("fraud_detected", {
          userId,
          reason: openBoxSuspicion.reason,
          type: "open_box_rate",
          timestamp: new Date().toISOString(),
        });
      }

      const rewardSuspicion = recordRewardEvent(userId, reward);
      if (rewardSuspicion.isSuspicious) {
        await logStructuredEvent("fraud_detected", {
          userId,
          reason: rewardSuspicion.reason,
          type: "reward_spike",
          amount: reward.toString(),
          timestamp: new Date().toISOString(),
        });
      }

      await tx.wallet.update({
        where: { userId },
        data: { cashBalance: { increment: reward } },
      });

      await logStructuredEvent("financial_operation", {
        userId,
        action: "box_reward_mutation_after",
        reward: reward.toString(),
        idempotencyKey,
        timestamp: new Date().toISOString(),
      });

      if (bonusUsed.gt(ZERO)) {
        await trackBonusUsage({ userId, bonusType: "box", amount: bonusUsed, tx });
      }

      const walletAfterReward = await tx.wallet.findUnique({ where: { userId } });
      if (!walletAfterReward) throw new Error("Wallet not found");

      await tx.transaction.create({
        data: {
          userId,
          boxId,
          type: "BOX_REWARD",
          amount: reward,
          balanceBefore: walletAfterDeduct.cashBalance.plus(walletAfterDeduct.bonusBalance),
          balanceAfter: walletAfterReward.cashBalance.plus(walletAfterReward.bonusBalance),
        },
      });

      await tx.boxOpen.create({
        data: { userId, boxId, rewardAmount: reward },
      });

      await tx.systemStats.upsert({
        where: { id: "global" },
        update: {
          totalIn: { increment: box.price },
          totalOut: { increment: reward },
          totalBoxesOpened: { increment: ONE },
        },
        create: {
          id: "global",
          totalIn: box.price,
          totalOut: reward,
          totalBoxesOpened: ONE,
          jackpotWins: ZERO,
        },
      });

      const playState = await tx.user.update({
        where: { id: userId },
        data: {
          totalPlaysCount: { increment: ONE },
          paidBoxesOpened: { increment: ONE },
          lastPlayTimestamp: new Date(),
        },
        select: { totalPlaysCount: true, referredById: true },
      });

      await unlockWaitlistBonusIfEligible(tx, userId);
      const referralActivation = await processReferralActivation(user.id);

      await detectRapidOnboardingCompletion(tx, userId);

      // Referral anti-abuse and delayed reward.
      if (shouldEvaluateReferralOnPlay(user.totalPlaysCount, playState.referredById)) {
        const referrer = await tx.user.findUnique({ where: { id: playState.referredById } });
        if (referrer && referrer.id === user.id) {
          await logReferral({ referrerId: playState.referredById, referredId: userId, ip: ip || "", deviceId, suspicious: true, tx });
          await logSuspiciousAction({ userId, type: "referral_fraud", metadata: { referrerId: playState.referredById }, tx });
        } else {
          const allowed = await checkReferralLimits({
            ip: ip || "",
            deviceId,
            referrerId: playState.referredById,
            referredId: userId,
            tx,
          });
          await logReferral({ referrerId: playState.referredById, referredId: userId, ip: ip || "", deviceId, suspicious: !allowed, tx });
          if (!allowed) {
            await logSuspiciousAction({ userId, type: "referral_fraud", metadata: { referrerId: playState.referredById }, tx });
          }
        }
      }

      const completedResponse = await completeIdempotencyKey({
        id: idempotencyKey,
        userId,
        response: {
          reward: reward.toString(),
          ...(referralActivation ? { referralActivation } : {}),
          walletSnapshot: {
            cashBalance: walletAfterReward.cashBalance,
            bonusBalance: walletAfterReward.bonusBalance,
            airtimeBalance: ZERO,
          },
        },
        metadata: {
          boxId,
          action: "openBox",
          ...(referralActivation ? { referralActivation } : {}),
          walletSnapshot: {
            cashBalance: walletAfterReward.cashBalance,
            bonusBalance: walletAfterReward.bonusBalance,
            airtimeBalance: ZERO,
          },
        },
        tx,
      });
      await logAudit({ userId, action: "box_open", details: { boxId, reward: reward.toString() }, tx });

      await logStructuredEvent("financial_operation", {
        userId,
        action: "box_opened",
        amount: box.price.toString(),
        reward: reward.toString(),
        idempotencyKey,
        timestamp: new Date().toISOString(),
      });

      return completedResponse;
    });
  }).catch(async (err) => {
    await logStructuredEvent("financial_operation", {
      userId,
      action: "box_open_failed",
      reward: null,
      idempotencyKey,
      timestamp: new Date().toISOString(),
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  });
}

export async function openFreeBox(
  userId: string,
  idempotencyKey: string,
  ip?: string,
  deviceId?: string
) {
  return withUserLock(userId, async () => {
    return withTransactionRetry(prisma, async (tx) => {
      await logStructuredEvent("financial_operation", {
        userId,
        action: "open_free_box_attempt",
        reward: null,
        idempotencyKey,
        timestamp: new Date().toISOString(),
      });

      const existing = await checkIdempotencyKey({ id: idempotencyKey, userId, tx });
      if (existing?.status === "COMPLETED") {
        await logStructuredEvent("financial_operation", {
          userId,
          action: "idempotency_replay",
          reward: (existing.response as Record<string, any> | null)?.data?.reward ?? null,
          idempotencyKey,
          timestamp: new Date().toISOString(),
        });
        return existing.response;
      }
      if (existing?.status === "PENDING") {
        throw new Error("Idempotent request is still processing");
      }

      try {
        await createIdempotencyKey({ id: idempotencyKey, userId, action: "openFreeBox", tx });
      } catch (err) {
        const duplicate = await checkIdempotencyKey({ id: idempotencyKey, userId, tx });
        if (duplicate?.status === "COMPLETED") {
          return duplicate.response;
        }
        if (duplicate?.status === "PENDING") {
          throw new Error("Idempotent request is still processing");
        }
        throw err;
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          isFrozen: true,
          accountStatus: true,
          riskScore: true,
          freeBoxUsed: true,
          totalPlaysCount: true,
          referredById: true,
          waitlistBonusUnlocked: true,
          lastPlayTimestamp: true,
        },
      });
      if (!user) throw new Error("User not found");
      const config = await getGameConfig(tx);
      const playAllowed = await canUserPlay({
        user: {
          isFrozen: user.isFrozen,
          accountStatus: user.accountStatus,
          riskScore: user.riskScore,
        },
        client: tx,
      });
      if (!playAllowed) {
        throw new Error("Account restricted");
      }

      await enforceGameplayPacing(tx, { id: user.id, lastPlayTimestamp: user.lastPlayTimestamp }, "openFreeBox");

      const markUsed = await tx.user.updateMany({
        where: { id: userId, freeBoxUsed: false },
        data: { freeBoxUsed: true },
      });

      if (markUsed.count === ZERO) {
        throw new Error("Free box already used");
      }

      await tx.boxOpenLog.create({
        data: { userId, ip: ip || "", deviceId, action: "freeBox" },
      });

      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new Error("Wallet not found");

      const context: RewardContext = { kind: "free_box" };
      const reward = generateReward(config, context);

      const openBoxSuspicion = recordBoxOpenAttempt(userId);
      if (openBoxSuspicion.isSuspicious) {
        await logStructuredEvent("fraud_detected", {
          userId,
          reason: openBoxSuspicion.reason,
          type: "open_box_rate",
          timestamp: new Date().toISOString(),
        });
      }

      const rewardSuspicion = recordRewardEvent(userId, reward);
      if (rewardSuspicion.isSuspicious) {
        await logStructuredEvent("fraud_detected", {
          userId,
          reason: rewardSuspicion.reason,
          type: "reward_spike",
          amount: reward.toString(),
          timestamp: new Date().toISOString(),
        });
      }

      await logStructuredEvent("financial_operation", {
        userId,
        action: "free_box_reward_mutation_before",
        reward: reward.toString(),
        idempotencyKey,
        timestamp: new Date().toISOString(),
      });

      const walletAfterReward = await tx.wallet.update({
        where: { userId },
        data: { cashBalance: { increment: reward } },
      });

      await logStructuredEvent("financial_operation", {
        userId,
        action: "free_box_reward_mutation_after",
        reward: reward.toString(),
        idempotencyKey,
        timestamp: new Date().toISOString(),
      });

      await tx.transaction.create({
        data: {
          userId,
          type: "FREE_BOX",
          amount: reward,
          balanceBefore: wallet.cashBalance.plus(wallet.bonusBalance),
          balanceAfter: walletAfterReward.cashBalance.plus(walletAfterReward.bonusBalance),
          meta: {
            source: "game_config",
            configuredRewardRange: `${config.minBoxReward}-${config.maxBoxReward}`,
            reward: reward.toString(),
          },
        },
      });

      const progress = await tx.user.update({
        where: { id: userId },
        data: { totalPlaysCount: { increment: ONE }, lastPlayTimestamp: new Date() },
        select: { totalPlaysCount: true, waitlistBonusUnlocked: true },
      });

      await logAudit({
        userId,
        action: "free_box_reward",
        details: {
          reward: reward.toString(),
          idempotencyKey,
          source: "game_config",
          configuredRewardRange: `${config.minBoxReward}-${config.maxBoxReward}`,
        },
        tx,
      });

      await unlockWaitlistBonusIfEligible(tx, userId);

      await detectRapidOnboardingCompletion(tx, userId);

      const completedResponse = await completeIdempotencyKey({
        id: idempotencyKey,
        userId,
        response: {
          reward: reward.toString(),
          totalPlaysCount: progress.totalPlaysCount,
          waitlistBonusUnlocked: progress.waitlistBonusUnlocked || progress.totalPlaysCount >= config.maxPlaysPerDay,
          waitlistBonusAmount: config.waitlistBonus.toString(),
          playsRequiredToUnlock: config.maxPlaysPerDay,
          walletSnapshot: {
            cashBalance: walletAfterReward.cashBalance,
            bonusBalance: walletAfterReward.bonusBalance,
          },
        },
        metadata: {
          action: "openFreeBox",
          totalPlaysCount: progress.totalPlaysCount,
          waitlistBonusUnlocked: progress.waitlistBonusUnlocked || progress.totalPlaysCount >= config.maxPlaysPerDay,
          waitlistBonusAmount: config.waitlistBonus,
          playsRequiredToUnlock: config.maxPlaysPerDay,
          walletSnapshot: {
            cashBalance: walletAfterReward.cashBalance,
            bonusBalance: walletAfterReward.bonusBalance,
          },
        },
        tx,
      });

      await logStructuredEvent("financial_operation", {
        userId,
        action: "box_opened",
        reward: reward.toString(),
        idempotencyKey,
        timestamp: new Date().toISOString(),
      });

      return completedResponse;
    });
  }).catch(async (err) => {
    await logStructuredEvent("financial_operation", {
      userId,
      action: "box_open_failed",
      reward: null,
      idempotencyKey,
      timestamp: new Date().toISOString(),
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  });
}

export async function getBoxes() {
  const boxes = await prisma.box.findMany({
    orderBy: { price: "asc" },
    select: {
      id: true,
      name: true,
      price: true,
    },
  });

  return boxes.map((box) => ({
    id: box.id,
    name: box.name,
    price: box.price,
  }));
}

type ReferralActivationResult = {
  referredUserId: string;
  referrerId: string;
  rewardAmount: string;
};

async function processReferralActivation(
  userId: string
) : Promise<ReferralActivationResult | null> {
  try {
    return await prisma.$transaction(async (tx) => {
      // Referred user acts as the referral record owner in current schema.
      const referralRecord = await tx.user.findUnique({
        where: { id: userId },
        select: {
          referredById: true,
          referralStatus: true,
        },
      });

      if (!referralRecord?.referredById) {
        return null;
      }

      const referredById = referralRecord.referredById;
      const config = await getGameConfig(tx);

      await logStructuredEvent("referral_activation_attempt", {
        userId,
        endpoint: "game/open-box",
        action: "referral_activation_attempt",
        inviterId: referredById,
        referredUserId: userId,
        status: referralRecord.referralStatus,
        rewardAmount: config.referralRewardAmount.toString(),
      });

      // STRICT lifecycle enforcement: only JOINED can become ACTIVE
      if (referralRecord.referralStatus !== "JOINED") {
        return null;
      }

      // Idempotent referral reward guard
      const existingGrant = await tx.referralRewardGrant.findUnique({
        where: { referredUserId: userId },
        select: { id: true },
      });

      if (existingGrant) {
        await logStructuredEvent("referral_duplicate_blocked", {
          userId,
          endpoint: "game/open-box",
          action: "referral_duplicate_blocked",
          inviterId: referredById,
          referredUserId: userId,
          status: referralRecord.referralStatus,
          rewardAmount: config.referralRewardAmount.toString(),
          reason: "reward_grant_already_exists",
        });
        return null;
      }
      const reward = config.referralRewardAmount;

      const referrer = await tx.user.findUnique({
        where: { id: referredById },
        select: {
          id: true,
          wallet: {
            select: { cashBalance: true, bonusBalance: true },
          },
        },
      });

      if (!referrer || !referrer.wallet) {
        return null;
      }

      const before = referrer.wallet.cashBalance.plus(referrer.wallet.bonusBalance);

      // Atomic referral reward: insert guard BEFORE wallet mutation
      await tx.referralRewardGrant.create({
        data: {
          referrerId: referredById,
          referredUserId: userId,
          amount: reward,
          sourceAction: "open_box_success",
        },
      });

      const activateResult = await tx.user.updateMany({
        where: { id: userId, referralStatus: "JOINED" },
        data: {
          referralStatus: "ACTIVE",
          referralActivatedAt: new Date(),
        },
      });

      if (activateResult.count === ZERO) {
        throw new Error("Referral status changed before activation");
      }

      await tx.wallet.update({
        where: { userId: referredById },
        data: { cashBalance: { increment: reward } },
      });

      await logAudit({
        userId,
        action: "referral_reward_triggered_from_game",
        details: {
          referredById,
          sourceAction: "open_box_success",
          referralStatusTransition: "JOINED_TO_ACTIVE",
        },
        tx,
      });

      await logStructuredEvent("referral_activated", {
        userId,
        endpoint: "game/open-box",
        action: "referral_activated",
        referrerId: referredById,
        referralStatus: "ACTIVE",
      });

      const referrerWalletAfter = await tx.wallet.findUnique({ where: { userId: referredById } });
      if (!referrerWalletAfter) {
        throw new Error("Referrer wallet not found");
      }

      await tx.transaction.create({
        data: {
          userId: referredById,
          type: "REFERRAL",
          amount: reward,
          balanceBefore: before,
          balanceAfter: referrerWalletAfter.cashBalance.plus(referrerWalletAfter.bonusBalance),
          meta: { referredUserId: userId, milestone: "open_box_first_success" },
        },
      });

      await logAudit({
        userId: referredById,
        action: "referral_reward",
        details: {
          rewardAmount: reward.toString(),
          referredUserId: userId,
          milestone: "open_box_first_success",
        },
        tx,
      });

      await logStructuredEvent("referral_reward_granted", {
        userId: referredById,
        endpoint: "game/open-box",
        action: "referral_reward_granted",
        inviterId: referredById,
        referredUserId: userId,
        status: "ACTIVE",
        rewardAmount: reward.toString(),
      });

      return {
        referredUserId: userId,
        referrerId: referredById,
        rewardAmount: reward.toString(),
      };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return null;
    }
    throw error;
  }
}