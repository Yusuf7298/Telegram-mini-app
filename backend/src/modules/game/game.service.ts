import { prisma } from "../../config/db";
import { Prisma } from "@prisma/client";
import { withTransactionRetry } from "../../services/withTransactionRetry";
import { generateRewardFromDB } from "../../services/reward.service";
import { incrementBoxesOpened, incrementJackpotWins } from "../../services/systemStats.service";
// NEW: Import hardening utilities
import { withUserLock } from "../../utils/lock";
import { logSuspiciousAction } from "../../services/suspiciousActionLog.service";
import { logAudit } from "../../services/auditLog.service";
import { createIdempotencyKey, completeIdempotencyKey, checkIdempotencyKey } from "../../services/idempotency.service";
import { trackBonusUsage } from "../../services/bonus.service";
import { logReferral, checkReferralLimits } from "../../services/referral.service";
import { assertDecimal, freezeMoneyObject } from '../../utils/assertDecimal';

type RewardRule = {
  reward: number;
  probability: number;
};

const PROBABILITY_SCALE = 1_000_000;

const WELCOME_BONUS_AMOUNT = 1000;
const WELCOME_BONUS_UNLOCK_PAID_BOXES = 5;
export async function openBox(
  userId: string,
  boxId: string,
  idempotencyKey: string,
  ip?: string,
  deviceId?: string
) {
  // NEW: Per-user lock to prevent concurrent opens
  return withUserLock(userId, async () => {
    // Rate limiting is now enforced by Redis middleware.
    // NEW: Transactional logic
    return withTransactionRetry(prisma, async (tx) => {
      // NEW: Check isFrozen
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("User not found");
      if (user.isFrozen) throw new Error("Account restricted");

      // NEW: Idempotency hardening
      let idempKey;
      try {
        idempKey = await createIdempotencyKey({ id: idempotencyKey, userId, action: "openBox", tx });
      } catch (err: any) {
        // If duplicate, check status
        idempKey = await checkIdempotencyKey({ id: idempotencyKey, userId, tx });
        if (idempKey && idempKey.status === "COMPLETED" && idempKey.rewardAmount !== undefined) {
          return idempKey.rewardAmount;
        }
        throw err;
      }

      // NEW: Log box open
      await tx.boxOpenLog.create({
        data: { userId, ip: ip || "", deviceId, action: "openBox" },
      });

      const box = await tx.box.findUnique({ where: { id: boxId } });
      if (!box) throw new Error("Box not found");
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new Error("Wallet not found");
      const totalBeforePurchase = wallet.cashBalance.plus(wallet.bonusBalance);
      if (totalBeforePurchase.lt(box.price)) {
        throw new Error("Insufficient balance");
      }
      let cashUsed = new Prisma.Decimal(0);
      let bonusUsed = new Prisma.Decimal(0);
      // UPDATED: Bonus system hardening (bonus cannot be withdrawn, bonus used first or after cash)
      if (wallet.bonusBalance.gte(box.price)) {
        bonusUsed = box.price;
      } else if (wallet.cashBalance.gte(box.price)) {
        cashUsed = box.price;
      } else {
        bonusUsed = wallet.bonusBalance;
        cashUsed = box.price.minus(bonusUsed);
      }
      const nextCashBalance = wallet.cashBalance.minus(cashUsed);
      const nextBonusBalance = wallet.bonusBalance.minus(bonusUsed);
      if (!cashUsed.plus(bonusUsed).equals(box.price)) {
        throw new Error("Invalid deduction split");
      }
      if (nextCashBalance.lt(0) || nextBonusBalance.lt(0)) {
        throw new Error("Invalid post-purchase balances");
      }
      // Only count paid boxes for welcome bonus progress
      const paidBoxTypes = ["Base", "Prime", "Mega"];
      const isPaidBox = paidBoxTypes.includes(box.name);
      const paidBoxesOpened = isPaidBox
        ? (await tx.user.findUnique({ where: { id: userId }, select: { paidBoxesOpened: true } }))?.paidBoxesOpened ?? 0
        : 0;
      const isFirstPlay = paidBoxesOpened === 0;
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
      if (deductResult.count === 0) {
        throw new Error("Balance changed, please retry");
      }
      const walletAfterDeduct = await tx.wallet.findUnique({ where: { userId } });
      if (!walletAfterDeduct) throw new Error("Wallet not found");
      const totalAfterPurchase = walletAfterDeduct.cashBalance.plus(walletAfterDeduct.bonusBalance);
      await tx.transaction.create({
        data: {
          userId,
          boxId,
          type: "BOX_PURCHASE",
          amount: -box.price,
          balanceBefore: totalBeforePurchase,
          balanceAfter: totalAfterPurchase,
          meta: { cashUsed, bonusUsed },
        },
      });
      // RTP: increment totalIn
      await tx.systemStats.upsert({
        where: { id: 'global' },
        update: { totalIn: { increment: box.price } },
        create: { id: 'global', totalIn: box.price, totalOut: new Prisma.Decimal(0), totalBoxesOpened: 1, jackpotWins: 0 },
      });
      // Generate reward from DB
      const rewardObj = await generateRewardFromDB(boxId, tx);
      const reward = rewardObj.amount;
      // NEW: All winnings from bonus go to cash, never to bonus
      await tx.wallet.update({
        where: { userId },
        data: { cashBalance: { increment: reward } },
      });
      // NEW: Track bonus usage if bonusUsed > 0
      if (bonusUsed.gt(0)) {
        await trackBonusUsage({ userId, bonusType: "box", amount: bonusUsed, tx });
      }
      const walletAfterReward = await tx.wallet.findUnique({ where: { userId } });
      if (!walletAfterReward) throw new Error("Wallet not found");
      if (walletAfterReward.cashBalance.lt(0) || walletAfterReward.bonusBalance.lt(0)) {
        throw new Error("Wallet balance is negative after reward credit");
      }
      await tx.transaction.create({
        data: {
          userId,
          boxId,
          type: "BOX_REWARD",
          amount: reward,
          balanceBefore: totalAfterPurchase,
          balanceAfter: walletAfterReward.cashBalance.plus(walletAfterReward.bonusBalance),
        },
      });
      await tx.boxOpen.create({
        data: { userId, boxId, rewardAmount: reward },
      });
      // RTP: increment totalOut and boxes opened
      await tx.systemStats.upsert({
        where: { id: 'global' },
        update: { totalOut: { increment: reward }, totalBoxesOpened: { increment: 1 } },
        create: { id: 'global', totalIn: new Prisma.Decimal(0), totalOut: reward, totalBoxesOpened: 1, jackpotWins: 0 },
      });
      // If jackpot, increment jackpotWins
      if (rewardObj.label?.toLowerCase().includes('jackpot') || rewardObj.category?.toLowerCase().includes('jackpot')) {
        await tx.systemStats.upsert({
          where: { id: 'global' },
          update: { jackpotWins: { increment: 1 } },
          create: { id: 'global', totalIn: new Prisma.Decimal(0), totalOut: new Prisma.Decimal(0), totalBoxesOpened: 0, jackpotWins: 1 },
        });
        // NEW: Audit log for jackpot win
        await logAudit({ userId, action: "jackpot_win", details: { boxId, reward }, tx });
      }
      // NEW: Audit log for box open
      await logAudit({ userId, action: "box_open", details: { boxId, reward }, tx });

      // Vault progress (existing logic)
      // Welcome bonus unlock: only increment paidBoxesOpened for paid boxes, unlock after 5
      let userProgress;
      if (isPaidBox) {
        userProgress = await tx.user.update({
          where: { id: userId },
          data: { paidBoxesOpened: { increment: 1 } },
          select: { paidBoxesOpened: true, welcomeBonusUnlocked: true, referredBy: true },
        });
      } else {
        userProgress = await tx.user.findUnique({ where: { id: userId }, select: { paidBoxesOpened: true, welcomeBonusUnlocked: true, referredBy: true } });
      }
      // Unlock welcome bonus after 5 paid boxes
      if (userProgress && !userProgress.welcomeBonusUnlocked && userProgress.paidBoxesOpened >= WELCOME_BONUS_UNLOCK_PAID_BOXES) {
        await tx.user.update({ where: { id: userId }, data: { welcomeBonusUnlocked: true } });
        await tx.wallet.update({ where: { userId }, data: { bonusLocked: false } });
      }

      // Vault progress (existing logic)
      const vaults = await tx.vault.findMany({ where: { isActive: true } });
      for (const vault of vaults) {
        const userVault = await tx.userVault.upsert({
          where: { userId_vaultId: { userId, vaultId: vault.id } },
          update: {},
          create: { userId, vaultId: vault.id, progress: 0 },
        });
        if (!userVault.claimed && userVault.progress < vault.target) {
          await tx.userVault.update({ where: { id: userVault.id }, data: { progress: { increment: 1 } } });
        }
      }

      // NEW: Referral protection (self-referral, IP/device limits, delayed reward, logging)
      if (isFirstPlay && userProgress.referredBy) {
        // Prevent self-referral (platformId check)
        const referrer = await tx.user.findUnique({ where: { id: userProgress.referredBy } });
        if (referrer && referrer.platformId === user.platformId) {
          await logReferral({ referrerId: userProgress.referredBy, referredId: userId, ip: ip || "", deviceId, suspicious: true, tx });
          await logSuspiciousAction({ userId, type: "self_referral", metadata: { referrerId: userProgress.referredBy }, tx });
        } else {
          // Limit referrals per IP/device
          const allowed = await checkReferralLimits({ ip: ip || "", deviceId, tx });
          await logReferral({ referrerId: userProgress.referredBy, referredId: userId, ip: ip || "", deviceId, suspicious: !allowed, tx });
          if (!allowed) {
            await logSuspiciousAction({ userId, type: "referral_limit_exceeded", metadata: { referrerId: userProgress.referredBy }, tx });
          } else {
            // Delay referral reward until ≥ 3 paid boxes
            const referredUser = await tx.user.findUnique({ where: { id: userId } });
            if (referredUser && referredUser.paidBoxesOpened >= 3) {
              const bonus = 500;
              const refWallet = await tx.wallet.findUnique({ where: { userId: userProgress.referredBy } });
              if (refWallet) {
                await tx.wallet.update({ where: { userId: userProgress.referredBy }, data: { cashBalance: { increment: bonus } } });
                const refWalletAfterReward = await tx.wallet.findUnique({ where: { userId: userProgress.referredBy } });
                if (!refWalletAfterReward) throw new Error("Referrer wallet not found");
                await tx.transaction.create({
                  data: {
                    userId: userProgress.referredBy,
                    type: "REFERRAL",
                    amount: bonus,
                    balanceBefore: refWallet.cashBalance.plus(refWallet.bonusBalance),
                    balanceAfter: refWalletAfterReward.cashBalance.plus(refWalletAfterReward.bonusBalance),
                  },
                });
                await tx.user.update({ where: { id: userProgress.referredBy }, data: { referrals: { increment: 1 } } });
                // NEW: Audit log for referral reward
                await logAudit({ userId: userProgress.referredBy, action: "referral_reward", details: { referredId: userId, bonus }, tx });
              }
            }
          }
        }
      }

      // NEW: Complete idempotency key
      await completeIdempotencyKey({ id: idempotencyKey, userId, response: reward, tx });

      // --- Advanced Behavioral Fraud Detection ---
      // Sliding window: last 50 plays for this user
      const last50Plays = await tx.boxOpen.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { rewardAmount: true }
      });
      if (last50Plays.length >= 20) { // Only analyze if enough data
        // 1. Consistent mid-tier wins (pattern abuse)
        // Define mid-tier as 20th-80th percentile of all possible rewards for this box
        const allRewards = await tx.boxReward.findMany({ where: { boxId }, select: { reward: true } });
        const rewardVals = allRewards.map(r => Number(r.reward)).sort((a, b) => a - b);
        if (rewardVals.length > 2) {
          const p20 = rewardVals[Math.floor(rewardVals.length * 0.2)];
          const p80 = rewardVals[Math.floor(rewardVals.length * 0.8)];
          const midTierCount = last50Plays.filter(p => {
            const val = Number(p.rewardAmount);
            return val >= p20 && val <= p80 && val > 0;
          }).length;
          if (midTierCount / last50Plays.length > 0.85) {
            await logSuspiciousAction({ userId, type: "mid_tier_win_pattern", metadata: { midTierCount, total: last50Plays.length, boxId }, tx });
          }
        }
        // 2. Loss-avoidance pattern: Unnaturally low loss streaks
        const lossCount = last50Plays.filter(p => Number(p.rewardAmount) === 0).length;
        if (lossCount / last50Plays.length < 0.05) { // <5% losses is suspicious
          await logSuspiciousAction({ userId, type: "loss_avoidance_pattern", metadata: { lossCount, total: last50Plays.length, boxId }, tx });
        }
        // 3. Unnatural reward distribution: Compare user vs expected
        // Calculate expected mean and stddev for this box
        const rewardMean = rewardVals.reduce((a, b) => a + b, 0) / rewardVals.length;
        const rewardStd = Math.sqrt(rewardVals.reduce((a, b) => a + Math.pow(b - rewardMean, 2), 0) / rewardVals.length);
        const userMean = last50Plays.reduce((a, b) => a + Number(b.rewardAmount), 0) / last50Plays.length;
        // If user mean deviates from expected by >2 stddev, flag
        if (Math.abs(userMean - rewardMean) > 2 * rewardStd) {
          await logSuspiciousAction({ userId, type: "unnatural_reward_distribution", metadata: { userMean, rewardMean, rewardStd, boxId }, tx });
        }
      }

      return reward;
    });
  });
}
        });
      }
    }

    const vaults = await tx.vault.findMany({
      where: { isActive: true },
    });

    for (const vault of vaults) {
      const userVault = await tx.userVault.upsert({
        where: {
          userId_vaultId: {
            userId,
            vaultId: vault.id,
          },
        },
        update: {},
        create: {
          userId,
          vaultId: vault.id,
          progress: 0,
        },
      });

      if (!userVault.claimed && userVault.progress < vault.target) {
        await tx.userVault.update({
          where: { id: userVault.id },
          data: {
            progress: { increment: 1 },
          },
        });
      }
    }

    if (isFirstPlay) {
      if (userProgress.referredBy) {
        const consumeReferral = await tx.user.updateMany({
          where: {
            id: userId,
            referredBy: userProgress.referredBy,
          },
          data: { referredBy: null },
        });

        if (consumeReferral.count === 1) {
          const bonus = 500;

          const refWallet = await tx.wallet.findUnique({
            where: { userId: userProgress.referredBy },
          });

          if (refWallet) {
            await tx.wallet.update({
              where: { userId: userProgress.referredBy },
              data: { cashBalance: { increment: bonus } },
            });

            const refWalletAfterReward = await tx.wallet.findUnique({
              where: { userId: userProgress.referredBy },
            });

            if (!refWalletAfterReward) throw new Error("Referrer wallet not found");

            await tx.transaction.create({
              data: {
                userId: userProgress.referredBy,
                type: "REFERRAL",
                amount: bonus,
                balanceBefore: refWallet.cashBalance.plus(refWallet.bonusBalance),
                balanceAfter: refWalletAfterReward.cashBalance.plus(
                  refWalletAfterReward.bonusBalance
                ),
              },
            });

            await tx.user.update({
              where: { id: userProgress.referredBy },
              data: {
                referrals: { increment: 1 },
              },
            });
          }
        }
      }
    }

    return reward;
  });
}

export async function openFreeBox(userId: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        freeBoxUsed: true,
        paidBoxesOpened: true,
      },
    });
    if (!user) throw new Error("User not found");

    const markUsed = await tx.user.updateMany({
      where: {
        id: userId,
        freeBoxUsed: false,
      },
      data: { freeBoxUsed: true },
    });

    if (markUsed.count === 0) {
      throw new Error("Free box already used");
    }

    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("Wallet not found");

    await tx.transaction.create({
      data: {
        userId,
        type: "FREE_BOX",
        amount: 0,
        balanceBefore: wallet.cashBalance.plus(wallet.bonusBalance),
        balanceAfter: wallet.cashBalance.plus(wallet.bonusBalance),
      },
    });

    return {
      lockedBonus: WELCOME_BONUS_AMOUNT,
      unlocked: false,
      paidBoxesOpened: user.paidBoxesOpened,
      paidBoxesRequired: WELCOME_BONUS_UNLOCK_PAID_BOXES,
      paidBoxesRemaining: Math.max(
        WELCOME_BONUS_UNLOCK_PAID_BOXES - user.paidBoxesOpened,
        0
      ),
    };
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