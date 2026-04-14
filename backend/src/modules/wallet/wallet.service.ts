import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import { withUserLock } from "../../utils/lock";
import { withTransactionRetry } from "../../services/withTransactionRetry";
import { createIdempotencyKey, checkIdempotencyKey, completeIdempotencyKey } from "../../services/idempotency.service";
import { logSuspiciousAction } from "../../services/suspiciousActionLog.service";
import { logStructuredEvent } from "../../services/logger";
import { recordWithdrawAttempt } from "../../services/fraudDetection.service";

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
      await logStructuredEvent("financial_operation", {
        userId,
        action: "deposit_attempt",
        amount: amount.toString(),
        idempotencyKey,
        timestamp: new Date().toISOString(),
      });

      const existing = await checkIdempotencyKey({ id: idempotencyKey, userId, tx });
      if (existing?.status === "COMPLETED") {
        await logStructuredEvent("financial_operation", {
          userId,
          action: "idempotency_replay",
          amount: amount.toString(),
          idempotencyKey,
          timestamp: new Date().toISOString(),
        });
        return existing.response;
      }
      if (existing?.status === "PENDING") {
        throw new Error("Idempotent request is still processing");
      }

      try {
        await createIdempotencyKey({ id: idempotencyKey, userId, action: "walletDeposit", tx });
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

      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new Error("Wallet not found");

      const before = wallet.cashBalance.plus(wallet.bonusBalance);
      const nextCash = wallet.cashBalance.plus(amount);

      await logStructuredEvent("financial_operation", {
        userId,
        action: "deposit_mutation_before",
        amount: amount.toString(),
        idempotencyKey,
        timestamp: new Date().toISOString(),
      });

      const updated = await tx.wallet.updateMany({
        where: { userId, cashBalance: wallet.cashBalance, bonusBalance: wallet.bonusBalance },
        data: { cashBalance: nextCash },
      });

      await logStructuredEvent("financial_operation", {
        userId,
        action: "deposit_mutation_after",
        amount: amount.toString(),
        idempotencyKey,
        timestamp: new Date().toISOString(),
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

      const completedResponse = await completeIdempotencyKey({
        id: idempotencyKey,
        userId,
        response: walletAfter,
        metadata: {
          action: "walletDeposit",
          amount: amount.toString(),
          walletSnapshot: walletAfter,
        },
        tx,
      });

      await logStructuredEvent("financial_operation", {
        userId,
        action: "deposit_success",
        amount: amount.toString(),
        idempotencyKey,
        timestamp: new Date().toISOString(),
      });

      return completedResponse;
    });
  }).catch(async (err) => {
    await logStructuredEvent("financial_operation", {
      userId,
      action: "deposit_failed",
      amount: amount.toString(),
      idempotencyKey,
      timestamp: new Date().toISOString(),
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
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
      await logStructuredEvent("financial_operation", {
        userId,
        action: "withdraw_attempt",
        amount: amount.toString(),
        idempotencyKey,
        timestamp: new Date().toISOString(),
      });

      const existing = await checkIdempotencyKey({ id: idempotencyKey, userId, tx });
      if (existing?.status === "COMPLETED") {
        await logStructuredEvent("financial_operation", {
          userId,
          action: "idempotency_replay",
          amount: amount.toString(),
          idempotencyKey,
          timestamp: new Date().toISOString(),
        });
        return existing.response;
      }
      if (existing?.status === "PENDING") {
        throw new Error("Idempotent request is still processing");
      }

      try {
        await createIdempotencyKey({ id: idempotencyKey, userId, action: "walletWithdraw", tx });
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
          isFrozen: true,
          accountStatus: true,
          riskScore: true,
          totalPlaysCount: true,
        },
      });

      if (!user) {
        throw new Error("User not found");
      }

      if (user.isFrozen || user.accountStatus === "FROZEN" || user.riskScore > WITHDRAW_BLOCK_RISK_THRESHOLD) {
        await logSuspiciousAction({
          userId,
          type: "withdrawal_risk",
          metadata: {
            reason: user.isFrozen ? "frozen_account_withdraw_attempt" : "high_risk_withdraw_attempt",
            riskScore: user.riskScore,
            accountStatus: user.accountStatus,
            isFrozen: user.isFrozen,
          },
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

      const withdrawSuspicion = recordWithdrawAttempt(userId);
      if (withdrawSuspicion.isSuspicious) {
        await logStructuredEvent("fraud_detected", {
          userId,
          reason: withdrawSuspicion.reason,
          type: "withdraw_frequency",
          amount: amount.toString(),
          idempotencyKey,
          timestamp: new Date().toISOString(),
        });
      }

      const withdrawableBonus = wallet.bonusLocked ? new Prisma.Decimal(0) : wallet.bonusBalance;
      const withdrawableTotal = wallet.cashBalance.plus(withdrawableBonus);
      if (withdrawableTotal.lt(amount)) throw new Error("Insufficient withdrawable balance");

      const before = wallet.cashBalance.plus(wallet.bonusBalance);
      const cashUsed = wallet.cashBalance.gte(amount) ? amount : wallet.cashBalance;
      const bonusUsed = amount.minus(cashUsed);
      const nextCash = wallet.cashBalance.minus(cashUsed);
      const nextBonus = wallet.bonusBalance.minus(bonusUsed);

      await logStructuredEvent("financial_operation", {
        userId,
        action: "withdraw_mutation_before",
        amount: amount.toString(),
        idempotencyKey,
        timestamp: new Date().toISOString(),
      });

      const updated = await tx.wallet.updateMany({
        where: { userId, cashBalance: wallet.cashBalance, bonusBalance: wallet.bonusBalance },
        data: { cashBalance: nextCash, bonusBalance: nextBonus },
      });

      await logStructuredEvent("financial_operation", {
        userId,
        action: "withdraw_mutation_after",
        amount: amount.toString(),
        idempotencyKey,
        timestamp: new Date().toISOString(),
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

      const completedResponse = await completeIdempotencyKey({
        id: idempotencyKey,
        userId,
        response: walletAfter,
        metadata: {
          action: "walletWithdraw",
          amount: amount.toString(),
          walletSnapshot: walletAfter,
        },
        tx,
      });

      await logStructuredEvent("financial_operation", {
        userId,
        action: "withdraw_success",
        amount: amount.toString(),
        idempotencyKey,
        timestamp: new Date().toISOString(),
      });

      return completedResponse;
    });
  }).catch(async (err) => {
    await logStructuredEvent("financial_operation", {
      userId,
      action: "withdraw_failed",
      amount: amount.toString(),
      idempotencyKey,
      timestamp: new Date().toISOString(),
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
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