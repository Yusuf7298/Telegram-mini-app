import { Prisma, TransactionType } from "@prisma/client";
import { prisma } from "../../config/db";
import { withUserLock } from "../../utils/lock";
import { withTransactionRetry } from "../../services/withTransactionRetry";
import { logAudit } from "../../services/auditLog.service";
import { getValidatedGameConfig } from "../../services/gameConfig.service";

type RewardConfig = {
  dailyRewardTable: string;
  dailyRewardBigWinThreshold: number;
  winHistoryBigWinThreshold: number;
};

async function getRewardConfig(): Promise<RewardConfig> {
  const config = await getValidatedGameConfig({ bypassCache: true });

  return {
    dailyRewardTable: config.dailyRewardTable,
    dailyRewardBigWinThreshold: config.dailyRewardBigWinThreshold,
    winHistoryBigWinThreshold: config.winHistoryBigWinThreshold,
  };
}

function parseRewardTable(configValue: string): number[] {
  const parsed = JSON.parse(configValue) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    throw new Error("Invalid daily reward table config");
  }

  return parsed;
}

function startOfUtcDay(input: Date): Date {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

function dayDiffInUtcDays(from: Date, to: Date): number {
  const fromDay = startOfUtcDay(from).getTime();
  const toDay = startOfUtcDay(to).getTime();
  return Math.floor((toDay - fromDay) / (24 * 60 * 60 * 1000));
}

function toDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function toAmountNumber(value: Prisma.Decimal | number | string): number {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function getEffectiveCurrentStreak(lastClaimAt: Date | null, currentStreak: number, now: Date): number {
  if (!lastClaimAt || currentStreak <= 0) {
    return 0;
  }

  const diff = dayDiffInUtcDays(lastClaimAt, now);
  if (diff <= 1) {
    return currentStreak;
  }

  return 0;
}

function getNextStreak(lastClaimAt: Date | null, currentStreak: number, now: Date, rewardTable: number[]): number {
  if (!lastClaimAt || currentStreak <= 0) {
    return 1;
  }

  const diff = dayDiffInUtcDays(lastClaimAt, now);
  if (diff === 1) {
    return Math.min(currentStreak + 1, rewardTable.length);
  }

  return 1;
}

function getRewardAmountForStreak(streak: number, rewardTable: number[]): number {
  const safeStreak = Math.min(Math.max(streak, 1), rewardTable.length);
  return rewardTable[safeStreak - 1];
}

function buildWalletSnapshot(wallet: { cashBalance: Prisma.Decimal; bonusBalance: Prisma.Decimal }) {
  return {
    cashBalance: wallet.cashBalance,
    bonusBalance: wallet.bonusBalance,
    airtimeBalance: 0,
  };
}

function mapWinType(type: TransactionType): string {
  if (type === "BOX_REWARD") return "box_reward";
  if (type === "FREE_BOX") return "free_box";
  if (type === "REFERRAL") return "referral_reward";
  if (type === "DAILY_REWARD") return "daily_reward";
  return "win";
}

export async function getDailyRewardStatus(userId: string) {
  const now = new Date();
  const todayStart = startOfUtcDay(now);
  const rewardConfig = await getRewardConfig();
  const rewardTable = parseRewardTable(rewardConfig.dailyRewardTable);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      dailyRewardStreak: true,
      lastDailyRewardClaimAt: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: {
      cashBalance: true,
      bonusBalance: true,
    },
  });

  if (!wallet) {
    throw new Error("Wallet not found");
  }

  const claimedToday = !!user.lastDailyRewardClaimAt && user.lastDailyRewardClaimAt >= todayStart;
  const effectiveCurrentStreak = getEffectiveCurrentStreak(user.lastDailyRewardClaimAt, user.dailyRewardStreak, now);
  const nextStreak = claimedToday
    ? Math.min(Math.max(effectiveCurrentStreak, 1), rewardTable.length)
    : getNextStreak(user.lastDailyRewardClaimAt, effectiveCurrentStreak, now, rewardTable);

  const nextRewardAmount = getRewardAmountForStreak(nextStreak, rewardTable);

  return {
    canClaim: !claimedToday,
    claimedToday,
    streak: effectiveCurrentStreak,
    nextStreak,
    nextRewardAmount,
    rewardTable,
    lastClaimAt: user.lastDailyRewardClaimAt,
    walletSnapshot: buildWalletSnapshot(wallet),
  };
}

export async function claimDailyReward(userId: string) {
  return withUserLock(userId, async () => {
    return withTransactionRetry(prisma, async (tx) => {
      const now = new Date();
      const todayStart = startOfUtcDay(now);
      const rewardConfig = await getRewardConfig();
      const rewardTable = parseRewardTable(rewardConfig.dailyRewardTable);

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          accountStatus: true,
          isFrozen: true,
          dailyRewardStreak: true,
          lastDailyRewardClaimAt: true,
        },
      });

      if (!user) {
        throw new Error("User not found");
      }

      if (user.isFrozen || user.accountStatus !== "ACTIVE") {
        throw new Error("Account restricted");
      }

      const alreadyClaimedToday = !!user.lastDailyRewardClaimAt && user.lastDailyRewardClaimAt >= todayStart;
      if (alreadyClaimedToday) {
        throw new Error("Daily reward already claimed");
      }

      const effectiveCurrentStreak = getEffectiveCurrentStreak(
        user.lastDailyRewardClaimAt,
        user.dailyRewardStreak,
        now,
      );
      const nextStreak = getNextStreak(user.lastDailyRewardClaimAt, effectiveCurrentStreak, now, rewardTable);
      const rewardAmount = getRewardAmountForStreak(nextStreak, rewardTable);
      const rewardAmountDecimal = toDecimal(rewardAmount);

      const walletBefore = await tx.wallet.findUnique({
        where: { userId },
        select: { cashBalance: true, bonusBalance: true },
      });

      if (!walletBefore) {
        throw new Error("Wallet not found");
      }

      const updatedWallet = await tx.wallet.update({
        where: { userId },
        data: {
          cashBalance: { increment: rewardAmountDecimal },
        },
        select: {
          cashBalance: true,
          bonusBalance: true,
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: "DAILY_REWARD",
          amount: rewardAmountDecimal,
          balanceBefore: walletBefore.cashBalance.plus(walletBefore.bonusBalance),
          balanceAfter: updatedWallet.cashBalance.plus(updatedWallet.bonusBalance),
          meta: {
            streak: nextStreak,
            claimDate: now.toISOString(),
            source: "daily_reward",
          },
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          dailyRewardStreak: nextStreak,
          lastDailyRewardClaimAt: now,
        },
      });

      await logAudit({
        userId,
        action: "daily_reward_claim",
        details: {
          rewardAmount,
          streak: nextStreak,
          claimDate: now.toISOString(),
        },
        tx,
      });

      return {
        rewardAmount,
        streak: nextStreak,
        claimedAt: now,
        isBigWin: rewardAmount >= rewardConfig.dailyRewardBigWinThreshold,
        rewardTable,
        walletSnapshot: buildWalletSnapshot(updatedWallet),
      };
    });
  });
}

export async function getWinHistory(userId: string, limitInput?: number) {
  const rewardConfig = await getRewardConfig();
  const limit = Number.isFinite(limitInput) && limitInput
    ? Math.min(Math.max(Math.floor(limitInput), 1), 100)
    : 20;

  const wins = await prisma.transaction.findMany({
    where: {
      userId,
      amount: { gt: 0 },
      type: {
        in: ["BOX_REWARD", "FREE_BOX", "REFERRAL", "DAILY_REWARD"],
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      amount: true,
      createdAt: true,
      meta: true,
      box: {
        select: {
          name: true,
        },
      },
    },
  });

  const timeline = wins.map((entry) => {
    const amount = toAmountNumber(entry.amount);
    const meta = entry.meta && typeof entry.meta === "object" && !Array.isArray(entry.meta)
      ? (entry.meta as Record<string, unknown>)
      : null;

    return {
      id: entry.id,
      type: mapWinType(entry.type),
      amount,
      createdAt: entry.createdAt,
      label: entry.box?.name || (entry.type === "DAILY_REWARD" ? "Daily reward" : "Reward"),
      streak: typeof meta?.streak === "number" ? meta.streak : null,
      isBigWin: amount >= rewardConfig.winHistoryBigWinThreshold,
    };
  });

  return {
    timeline,
    bigWinThreshold: rewardConfig.winHistoryBigWinThreshold,
  };
}
