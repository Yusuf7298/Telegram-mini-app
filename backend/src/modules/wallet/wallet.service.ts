import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import { withUserLock } from "../../utils/lock";
import { withTransactionRetry } from "../../services/withTransactionRetry";
import { createIdempotencyKey, checkIdempotencyKey, completeIdempotencyKey } from "../../services/idempotency.service";
import { logSuspiciousAction } from "../../services/suspiciousActionLog.service";

const WITHDRAW_BLOCK_RISK_THRESHOLD = 70;
const WITHDRAW_MIN_PLAYS = 5;
const WITHDRAW_REWARD_COOLDOWN_MS = 60 * 1000;

function toDecimal(value: Prisma.Decimal | string | number) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

export async function depositWallet(
  userId: string,
  amountInput: Prisma.Decimal | string | number,
  idempotencyKey: string
) {
  const amount = toDecimal(amountInput);
  if (amount.lte(0)) throw new Error("Amount must be greater than zero");

  return withUserLock(userId, async () => {
    return withTransactionRetry(prisma, async (tx) => {
      let idempKey;
      try {
        idempKey = await createIdempotencyKey({ id: idempotencyKey, userId, action: "walletDeposit", tx });
      } catch (err: any) {
        idempKey = await checkIdempotencyKey({ id: idempotencyKey, userId, tx });
        if (idempKey && idempKey.status === "COMPLETED") {
          return idempKey.response as Record<string, unknown>;
        }
        throw err;
      }

      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new Error("Wallet not found");

      const before = wallet.cashBalance.plus(wallet.bonusBalance);
      const nextCash = wallet.cashBalance.plus(amount);

      const updated = await tx.wallet.updateMany({
        where: { userId, cashBalance: wallet.cashBalance, bonusBalance: wallet.bonusBalance },
        data: { cashBalance: nextCash },
      });

      if (updated.count === 0) {
        throw new Error("Balance changed, please retry");
      }

      await tx.transaction.create({
        data: {
          userId,
          type: "BOX_REWARD",
          amount,
          balanceBefore: before,
          balanceAfter: nextCash.plus(wallet.bonusBalance),
        },
      });

      const walletAfter = await tx.wallet.findUnique({ where: { userId } });
      if (!walletAfter) throw new Error("Wallet not found");

      await completeIdempotencyKey({ id: idempotencyKey, userId, response: walletAfter, tx });
      return walletAfter;
    });
  });
}

export async function withdrawWallet(
  userId: string,
  amountInput: Prisma.Decimal | string | number,
  idempotencyKey: string
) {
  const amount = toDecimal(amountInput);
  if (amount.lte(0)) throw new Error("Amount must be greater than zero");

  return withUserLock(userId, async () => {
    return withTransactionRetry(prisma, async (tx) => {
      let idempKey;
      try {
        idempKey = await createIdempotencyKey({ id: idempotencyKey, userId, action: "walletWithdraw", tx });
      } catch (err: any) {
        idempKey = await checkIdempotencyKey({ id: idempotencyKey, userId, tx });
        if (idempKey && idempKey.status === "COMPLETED") {
          return idempKey.response as Record<string, unknown>;
        }
        throw err;
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          accountStatus: true,
          riskScore: true,
          totalPlaysCount: true,
        },
      });

      if (!user) {
        throw new Error("User not found");
      }

      if (user.accountStatus === "FROZEN" || user.riskScore > WITHDRAW_BLOCK_RISK_THRESHOLD) {
        await logSuspiciousAction({
          userId,
          type: "withdrawal_risk",
          metadata: { reason: "high_risk_withdraw_attempt", riskScore: user.riskScore, accountStatus: user.accountStatus },
          tx,
        });
        throw new Error("Withdrawals are restricted for this account");
      }

      if (user.totalPlaysCount < WITHDRAW_MIN_PLAYS) {
        await logSuspiciousAction({
          userId,
          type: "withdrawal_risk",
          metadata: {
            reason: "minimum_play_requirement_not_met",
            totalPlaysCount: user.totalPlaysCount,
            required: WITHDRAW_MIN_PLAYS,
          },
          tx,
        });
        throw new Error("Minimum gameplay activity required before withdrawal");
      }

      const latestReward = await tx.transaction.findFirst({
        where: { userId, type: "BOX_REWARD" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      if (latestReward) {
        const sinceRewardMs = Date.now() - latestReward.createdAt.getTime();
        if (sinceRewardMs < WITHDRAW_REWARD_COOLDOWN_MS) {
          await logSuspiciousAction({
            userId,
            type: "withdrawal_risk",
            metadata: {
              reason: "reward_cooldown",
              cooldownMs: WITHDRAW_REWARD_COOLDOWN_MS,
              elapsedMs: sinceRewardMs,
            },
            tx,
          });
          throw new Error("Withdrawal is temporarily locked after recent rewards");
        }
      }

      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new Error("Wallet not found");

      const withdrawableBonus = wallet.bonusLocked ? new Prisma.Decimal(0) : wallet.bonusBalance;
      const withdrawableTotal = wallet.cashBalance.plus(withdrawableBonus);
      if (withdrawableTotal.lt(amount)) throw new Error("Insufficient withdrawable balance");

      const before = wallet.cashBalance.plus(wallet.bonusBalance);
      const cashUsed = wallet.cashBalance.gte(amount) ? amount : wallet.cashBalance;
      const bonusUsed = amount.minus(cashUsed);
      const nextCash = wallet.cashBalance.minus(cashUsed);
      const nextBonus = wallet.bonusBalance.minus(bonusUsed);

      const updated = await tx.wallet.updateMany({
        where: { userId, cashBalance: wallet.cashBalance, bonusBalance: wallet.bonusBalance },
        data: { cashBalance: nextCash, bonusBalance: nextBonus },
      });

      if (updated.count === 0) {
        throw new Error("Balance changed, please retry");
      }

      await tx.transaction.create({
        data: {
          userId,
          type: "BOX_PURCHASE",
          amount: amount.neg(),
          balanceBefore: before,
          balanceAfter: nextCash.plus(nextBonus),
          meta: {
            cashUsed: cashUsed.toString(),
            bonusUsed: bonusUsed.toString(),
            bonusLocked: wallet.bonusLocked,
          },
        },
      });

      const walletAfter = await tx.wallet.findUnique({ where: { userId } });
      if (!walletAfter) throw new Error("Wallet not found");

      await completeIdempotencyKey({ id: idempotencyKey, userId, response: walletAfter, tx });
      return walletAfter;
    });
  });
}

export async function checkWalletIntegrity(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) return false;
  return wallet.cashBalance.gte(0) && wallet.bonusBalance.gte(0);
}

export async function credit(userId: string, amount: Prisma.Decimal, _meta: any = {}, tx: Prisma.TransactionClient) {
  if (amount.lte(0)) throw new Error("Amount must be greater than zero");
  await tx.wallet.update({ where: { userId }, data: { cashBalance: { increment: amount } } });
  return tx.wallet.findUnique({ where: { userId } });
}

export async function debit(userId: string, amount: Prisma.Decimal, _meta: any = {}, tx: Prisma.TransactionClient) {
  if (amount.lte(0)) throw new Error("Amount must be greater than zero");
  const wallet = await tx.wallet.findUnique({ where: { userId } });
  if (!wallet || wallet.cashBalance.lt(amount)) throw new Error("Insufficient cash balance");
  await tx.wallet.update({ where: { userId }, data: { cashBalance: { decrement: amount } } });
  return tx.wallet.findUnique({ where: { userId } });
}

export async function transfer(fromUserId: string, toUserId: string, amount: Prisma.Decimal, _meta: any = {}, tx: Prisma.TransactionClient) {
  await debit(fromUserId, amount, {}, tx);
  await credit(toUserId, amount, {}, tx);
  return {
    from: await tx.wallet.findUnique({ where: { userId: fromUserId } }),
    to: await tx.wallet.findUnique({ where: { userId: toUserId } }),
  };
}

export async function applyReward(userId: string, cashChange: Prisma.Decimal, bonusChange: Prisma.Decimal, _meta: any = {}, tx: Prisma.TransactionClient) {
  await tx.wallet.update({
    where: { userId },
    data: {
      cashBalance: { increment: cashChange },
      bonusBalance: { increment: bonusChange },
    },
  });
  return tx.wallet.findUnique({ where: { userId } });
}