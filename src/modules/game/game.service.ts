import { prisma } from "../../config/db";
import { Prisma } from "@prisma/client";

type RewardRule = {
  reward: number;
  probability: number;
};

const PROBABILITY_SCALE = 1_000_000;

const WELCOME_BONUS_AMOUNT = 1000;
const WELCOME_BONUS_UNLOCK_PAID_BOXES = 5;

const DEFAULT_REWARD_TABLES: Record<string, RewardRule[]> = {
  "100": [
    { reward: 0, probability: 0.4 },
    { reward: 50, probability: 0.32 },
    { reward: 100, probability: 0.17 },
    { reward: 200, probability: 0.07 },
    { reward: 500, probability: 0.03 },
    { reward: 1000, probability: 0.01 },
  ],
  "200": [
    { reward: 0, probability: 0.45 },
    { reward: 100, probability: 0.3 },
    { reward: 200, probability: 0.16 },
    { reward: 400, probability: 0.07 },
    { reward: 1000, probability: 0.01 },
    { reward: 5000, probability: 0.01 },
  ],
  "500": [
    { reward: 0, probability: 0.5 },
    { reward: 250, probability: 0.3 },
    { reward: 500, probability: 0.1 },
    { reward: 1000, probability: 0.06 },
    { reward: 3000, probability: 0.03 },
    { reward: 10000, probability: 0.01 },
  ],
};

function hasExactOneProbabilitySum(table: RewardRule[]) {
  const scaledSum = table.reduce(
    (sum, item) => sum + Math.round(item.probability * PROBABILITY_SCALE),
    0
  );

  return scaledSum === PROBABILITY_SCALE;
}

function isValidRewardTable(raw: unknown): raw is RewardRule[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return false;
  }

  const sum = raw.reduce((acc, item) => {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as RewardRule).reward !== "number" ||
      typeof (item as RewardRule).probability !== "number" ||
      (item as RewardRule).probability < 0 ||
      (item as RewardRule).probability > 1
    ) {
      return Number.NaN;
    }

    return acc + (item as RewardRule).probability;
  }, 0);

  return Number.isFinite(sum) && hasExactOneProbabilitySum(raw as RewardRule[]);
}

function getRewardTable(box: { price: { toString(): string }; rewardTable: unknown }): RewardRule[] {
  if (isValidRewardTable(box.rewardTable)) {
    return box.rewardTable;
  }

  const key = Number(box.price.toString()).toFixed(0);
  const table = DEFAULT_REWARD_TABLES[key];

  if (!table) {
    throw new Error("Unsupported box configuration");
  }

  return table;
}

function pickReward(table: RewardRule[]): number {
  const roll = Math.random();

  let cursor = 0;
  for (const item of table) {
    cursor += item.probability;
    if (roll <= cursor) {
      return item.reward;
    }
  }

  return table[table.length - 1].reward;
}

export async function openBox(
  userId: string,
  boxId: string,
  idempotencyKey: string
) {
  const existingKey = await prisma.idempotencyKey.findUnique({
    where: { id: idempotencyKey },
    select: {
      userId: true,
      rewardAmount: true,
    },
  });

  if (existingKey) {
    if (existingKey.userId !== userId) {
      throw new Error("Idempotency key already used by another user");
    }

    return Number(existingKey.rewardAmount.toString());
  }

  try {
    return await prisma.$transaction(async (tx) => {
    const box = await tx.box.findUnique({
      where: { id: boxId },
      select: {
        id: true,
        price: true,
        rewardTable: true,
      },
    });

    if (!box) throw new Error("Box not found");

    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("Wallet not found");

    const totalBeforePurchase = wallet.cashBalance.plus(wallet.bonusBalance);

    if (totalBeforePurchase.lessThan(box.price)) {
      throw new Error("Insufficient balance");
    }

    let cashUsed = new Prisma.Decimal(0);
    let bonusUsed = new Prisma.Decimal(0);

    if (wallet.cashBalance.greaterThanOrEqualTo(box.price)) {
      cashUsed = box.price;
    } else {
      cashUsed = wallet.cashBalance;
      bonusUsed = box.price.minus(cashUsed);
    }

    const nextCashBalance = wallet.cashBalance.minus(cashUsed);
    const nextBonusBalance = wallet.bonusBalance.minus(bonusUsed);

    if (!cashUsed.plus(bonusUsed).equals(box.price)) {
      throw new Error("Invalid deduction split");
    }

    if (nextCashBalance.lessThan(0) || nextBonusBalance.lessThan(0)) {
      throw new Error("Invalid post-purchase balances");
    }

    const previousPlays = await tx.boxOpen.count({
      where: { userId },
    });

    const isFirstPlay = previousPlays === 0;

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

    const totalAfterPurchase = walletAfterDeduct.cashBalance.plus(
      walletAfterDeduct.bonusBalance
    );

    await tx.transaction.create({
      data: {
        userId,
        boxId,
        type: "BOX_PURCHASE",
        amount: -box.price,
        balanceBefore: totalBeforePurchase,
        balanceAfter: totalAfterPurchase,
        meta: {
          cashUsed: cashUsed.toString(),
          bonusUsed: bonusUsed.toString(),
        },
      },
    });

    const reward = pickReward(getRewardTable(box));

    await tx.wallet.update({
      where: { userId },
      data: { cashBalance: { increment: reward } },
    });

    const walletAfterReward = await tx.wallet.findUnique({ where: { userId } });
    if (!walletAfterReward) throw new Error("Wallet not found");

    await tx.transaction.create({
      data: {
        userId,
        boxId,
        type: "BOX_REWARD",
        amount: reward,
        balanceBefore: totalAfterPurchase,
        balanceAfter: walletAfterReward.cashBalance.plus(
          walletAfterReward.bonusBalance
        ),
      },
    });

    await tx.boxOpen.create({
      data: {
        userId,
        boxId,
        rewardAmount: reward,
      },
    });

    await tx.idempotencyKey.create({
      data: {
        id: idempotencyKey,
        userId,
        boxId,
        rewardAmount: reward,
      },
    });

    const userProgress = await tx.user.update({
      where: { id: userId },
      data: {
        paidBoxesOpened: { increment: 1 },
      },
      select: {
        paidBoxesOpened: true,
        welcomeBonusUnlocked: true,
        referredBy: true,
      },
    });

    if (
      !userProgress.welcomeBonusUnlocked &&
      userProgress.paidBoxesOpened >= WELCOME_BONUS_UNLOCK_PAID_BOXES
    ) {
      const markWelcomeUnlocked = await tx.user.updateMany({
        where: {
          id: userId,
          welcomeBonusUnlocked: false,
          paidBoxesOpened: { gte: WELCOME_BONUS_UNLOCK_PAID_BOXES },
        },
        data: { welcomeBonusUnlocked: true },
      });

      if (markWelcomeUnlocked.count === 1) {
        const walletBeforeWelcomeBonus = await tx.wallet.findUnique({
          where: { userId },
        });
        if (!walletBeforeWelcomeBonus) throw new Error("Wallet not found");

        await tx.wallet.update({
          where: { userId },
          data: { bonusBalance: { increment: WELCOME_BONUS_AMOUNT } },
        });

        const walletAfterWelcomeBonus = await tx.wallet.findUnique({
          where: { userId },
        });
        if (!walletAfterWelcomeBonus) throw new Error("Wallet not found");

        await tx.transaction.create({
          data: {
            userId,
            type: "BOX_REWARD",
            amount: WELCOME_BONUS_AMOUNT,
            balanceBefore: walletBeforeWelcomeBonus.cashBalance.plus(
              walletBeforeWelcomeBonus.bonusBalance
            ),
            balanceAfter: walletAfterWelcomeBonus.cashBalance.plus(
              walletAfterWelcomeBonus.bonusBalance
            ),
          },
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
  } catch (err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const replayedKey = await prisma.idempotencyKey.findUnique({
        where: { id: idempotencyKey },
        select: {
          userId: true,
          rewardAmount: true,
        },
      });

      if (replayedKey && replayedKey.userId === userId) {
        return Number(replayedKey.rewardAmount.toString());
      }
    }

    throw err;
  }
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