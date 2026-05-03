export interface WithdrawInput {
  userId: string;
  amount: number | string | Prisma.Decimal;
  idempotencyKey: string;
}

export interface DepositInput {
  userId: string;
  amount: number | string | Prisma.Decimal;
  idempotencyKey: string;
}


import { Prisma, User, Wallet } from "@prisma/client";
import { prisma } from "../../config/db";
import { withUserLock } from "../../utils/lock";
import { withTransactionRetry } from "../../services/withTransactionRetry";
import { createIdempotencyKey, checkIdempotencyKey, completeIdempotencyKey } from "../../services/idempotency.service";
import { logSuspiciousAction } from "../../services/suspiciousActionLog.service";
import { logStructuredEvent } from "../../services/logger";
import { recordWithdrawAttempt } from "../../services/fraudDetection.service";
import { logAudit } from "../../services/auditLog.service";
import { canUserWithdraw } from "../../services/rules.service";
import { ZERO } from "../../constants/numbers";


// Withdraw function with explicit parameters and correct transaction scoping
export async function withdrawWallet({ userId, amount, idempotencyKey }: WithdrawInput): Promise<any> {
  // Strict validation
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    throw new Error("Invalid userId");
  }
  if (!idempotencyKey || typeof idempotencyKey !== "string" || idempotencyKey.trim() === "") {
    throw new Error("Invalid idempotencyKey");
  }

  // Coerce amount to Prisma.Decimal (accept number | string | Decimal)
  let decimalAmount: Prisma.Decimal;
  try {
    decimalAmount = amount instanceof Prisma.Decimal ? amount : new Prisma.Decimal(amount as any);
  } catch {
    throw new Error("Invalid withdraw amount");
  }
  if (decimalAmount.lte(0)) throw new Error("Amount must be greater than zero");

  try {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Idempotency: check existing
      const existing = await checkIdempotencyKey({ id: idempotencyKey, userId, tx });
      if (existing?.status === "COMPLETED") {
        return existing.response;
      }
      if (existing?.status === "PENDING") {
        throw new Error("Idempotent request is still processing");
      }

      // Create pending idempotency record
      await createIdempotencyKey({ id: idempotencyKey, userId, action: "walletWithdraw", tx });

      // Lock wallet row to ensure concurrency safety
      await tx.$executeRaw`SELECT 1 FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;

      // Fetch user and wallet
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("User not found");

      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new Error("Wallet not found");

      // Business rules check
      const latestReward = await tx.transaction.findFirst({
        where: { userId, type: "BOX_REWARD" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      const withdrawRule = await canUserWithdraw({
        user,
        lastRewardAt: latestReward?.createdAt ?? null,
        client: tx,
      });

      if (!withdrawRule.allowed) {
        await logSuspiciousAction({
          userId,
          type: "withdrawal_risk",
          metadata: {
            reason: withdrawRule.reason,
            riskScore: user.riskScore,
            accountStatus: user.accountStatus,
            isFrozen: user.isFrozen,
            totalPlaysCount: user.totalPlaysCount,
            required: withdrawRule.requiredMinPlays,
            cooldownMs: withdrawRule.cooldownMs,
            elapsedMs: withdrawRule.elapsedMs,
          },
          tx,
        });

        if (
          withdrawRule.reason === "frozen_account_withdraw_attempt" ||
          withdrawRule.reason === "high_risk_withdraw_attempt"
        ) {
          throw new Error("Withdrawals are restricted for this account");
        }
        if (withdrawRule.reason === "minimum_play_requirement_not_met") {
          throw new Error("Minimum gameplay activity required before withdrawal");
        }
        if (withdrawRule.reason === "reward_cooldown") {
          throw new Error("Withdrawal is temporarily locked after recent rewards");
        }
      }

      // Fraud detection
      const withdrawSuspicion = await recordWithdrawAttempt(userId);
      if (withdrawSuspicion.isSuspicious) {
        await logStructuredEvent("fraud_detected", {
          userId,
          reason: withdrawSuspicion.reason,
          type: "withdraw_frequency",
          amount: decimalAmount.toString(),
          idempotencyKey,
          timestamp: new Date().toISOString(),
        });
      }

      // Compute withdrawable balances
      const withdrawableBonus = wallet.bonusLocked ? new Prisma.Decimal(ZERO) : wallet.bonusBalance;
      const withdrawableTotal = wallet.cashBalance.plus(withdrawableBonus);
      if (withdrawableTotal.lt(decimalAmount)) throw new Error("Insufficient withdrawable balance");

      const before = wallet.cashBalance.plus(wallet.bonusBalance);
      const cashUsed = wallet.cashBalance.gte(decimalAmount) ? decimalAmount : wallet.cashBalance;
      const bonusUsed = decimalAmount.minus(cashUsed);
      const nextCash = wallet.cashBalance.minus(cashUsed);
      const nextBonus = wallet.bonusBalance.minus(bonusUsed);

      await logStructuredEvent("financial_operation", {
        userId,
        action: "withdraw_mutation_before",
        amount: decimalAmount.toString(),
        idempotencyKey,
        timestamp: new Date().toISOString(),
      });

      // Apply balance changes (row is locked)
      const updatedWallet = await tx.wallet.update({
        where: { userId },
        data: { cashBalance: nextCash, bonusBalance: nextBonus },
      });

      await logStructuredEvent("financial_operation", {
        userId,
        action: "withdraw_mutation_after",
        amount: decimalAmount.toString(),
        idempotencyKey,
        timestamp: new Date().toISOString(),
      });

      await tx.transaction.create({
        data: {
          userId,
          type: "BOX_PURCHASE",
          amount: decimalAmount.neg(),
          balanceBefore: before,
          balanceAfter: nextCash.plus(nextBonus),
          meta: {
            cashUsed: cashUsed.toString(),
            bonusUsed: bonusUsed.toString(),
            bonusLocked: wallet.bonusLocked,
          },
        },
      });

      await logAudit({
        userId,
        action: "wallet_withdraw",
        details: {
          amount: decimalAmount.toString(),
          cashUsed: cashUsed.toString(),
          bonusUsed: bonusUsed.toString(),
          idempotencyKey,
        },
        tx,
      });

      const completedResponse = await completeIdempotencyKey({
        id: idempotencyKey,
        userId,
        response: {
          success: true,
          amount: decimalAmount.toString(),
          walletSnapshot: {
            cashBalance: updatedWallet.cashBalance,
            bonusBalance: updatedWallet.bonusBalance,
            airtimeBalance: ZERO,
          },
        },
        metadata: {
          action: "walletWithdraw",
          amount: decimalAmount.toString(),
        },
        tx,
      });

      await logStructuredEvent("financial_operation", {
        userId,
        action: "withdraw_success",
        amount: decimalAmount.toString(),
        idempotencyKey,
        timestamp: new Date().toISOString(),
      });

      return completedResponse;
    });
  } catch (err) {
    await logStructuredEvent("financial_operation", {
      userId,
      action: "withdraw_failed",
      amount: amount?.toString?.() ?? String(amount),
      idempotencyKey,
      timestamp: new Date().toISOString(),
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// Deposit function with explicit parameters and correct transaction scoping
export async function depositWallet({ userId, amount, idempotencyKey }: DepositInput): Promise<any> {
  // TODO: Implement deposit logic similar to withdrawWallet, using the same input validation and idempotency pattern.
  // This is a placeholder to ensure correct function boundaries and typing.
  throw new Error("depositWallet not yet implemented");
}


export async function checkWalletIntegrity(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) return false;
  return wallet.cashBalance.gte(ZERO) && wallet.bonusBalance.gte(ZERO);
}

export async function credit(
  userId: string,
  amount: Prisma.Decimal | number | string,
  _meta: any = {},
  tx: Prisma.TransactionClient
): Promise<Wallet> {
  if (!userId || typeof userId !== "string") throw new Error("Invalid userId");
  let decimalAmount: Prisma.Decimal;
  try {
    decimalAmount = new Prisma.Decimal(amount);
  } catch {
    throw new Error("Amount must be a valid number or decimal");
  }
  if (decimalAmount.lte(0)) throw new Error("Amount must be greater than zero");
  await tx.wallet.update({ where: { userId }, data: { cashBalance: { increment: decimalAmount } } });
  const wallet = await tx.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error("Wallet not found after credit");
  return wallet;
}

export async function debit(
  userId: string,
  amount: Prisma.Decimal | number | string,
  _meta: any = {},
  tx: Prisma.TransactionClient
): Promise<Wallet> {
  if (!userId || typeof userId !== "string") throw new Error("Invalid userId");
  let decimalAmount: Prisma.Decimal;
  try {
    decimalAmount = new Prisma.Decimal(amount);
  } catch {
    throw new Error("Amount must be a valid number or decimal");
  }
  if (decimalAmount.lte(0)) throw new Error("Amount must be greater than zero");
  const wallet = await tx.wallet.findUnique({ where: { userId } });
  if (!wallet || wallet.cashBalance.lt(decimalAmount)) throw new Error("Insufficient cash balance");
  await tx.wallet.update({ where: { userId }, data: { cashBalance: { decrement: decimalAmount } } });
  const updatedWallet = await tx.wallet.findUnique({ where: { userId } });
  if (!updatedWallet) throw new Error("Wallet not found after debit");
  return updatedWallet;
}

export async function transfer(
  fromUserId: string,
  toUserId: string,
  amount: Prisma.Decimal | number | string,
  _meta: any = {},
  tx: Prisma.TransactionClient
): Promise<{ from: Wallet; to: Wallet }> {
  if (!fromUserId || typeof fromUserId !== "string") throw new Error("Invalid fromUserId");
  if (!toUserId || typeof toUserId !== "string") throw new Error("Invalid toUserId");
  let decimalAmount: Prisma.Decimal;
  try {
    decimalAmount = new Prisma.Decimal(amount);
  } catch {
    throw new Error("Amount must be a valid number or decimal");
  }
  if (decimalAmount.lte(0)) throw new Error("Amount must be greater than zero");
  await debit(fromUserId, decimalAmount, {}, tx);
  await credit(toUserId, decimalAmount, {}, tx);
  const from = await tx.wallet.findUnique({ where: { userId: fromUserId } });
  const to = await tx.wallet.findUnique({ where: { userId: toUserId } });
  if (!from || !to) throw new Error("Wallet not found after transfer");
  return { from, to };
}

export async function applyReward(
  userId: string,
  cashChange: Prisma.Decimal | number | string,
  bonusChange: Prisma.Decimal | number | string,
  _meta: any = {},
  tx: Prisma.TransactionClient
): Promise<Wallet> {
  if (!userId || typeof userId !== "string") throw new Error("Invalid userId");
  let decimalCash: Prisma.Decimal;
  let decimalBonus: Prisma.Decimal;
  try {
    decimalCash = new Prisma.Decimal(cashChange);
    decimalBonus = new Prisma.Decimal(bonusChange);
  } catch {
    throw new Error("cashChange and bonusChange must be valid numbers or decimals");
  }
  await tx.wallet.update({
    where: { userId },
    data: {
      cashBalance: { increment: decimalCash },
      bonusBalance: { increment: decimalBonus },
    },
  });
  const wallet = await tx.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error("Wallet not found after applyReward");
  return wallet;
}