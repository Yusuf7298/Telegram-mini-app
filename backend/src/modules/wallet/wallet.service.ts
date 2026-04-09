import { prisma } from "../../config/db";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import { Prisma } from "@prisma/client";
import { D, add, sub, lt } from '../utils/money';
import { assertDecimal, freezeMoneyObject } from '../../utils/assertDecimal';
import { trackBonusUsage } from "../../services/bonus.service";
import { logAudit } from "../../services/auditLog.service";
import { logSuspiciousAction } from "../../services/suspiciousActionLog.service";
import { withRetry } from "../../services/withTransactionRetry";
import path from 'path';
import { fileURLToPath } from 'url';
  amount: Prisma.Decimal,
// Internal audit log for wallet mutations
function logWalletMutation(action: string, userId: string, meta: any = {}) {
  const stack = new Error().stack?.split('\n').slice(2, 5).join(' | ');
  // You can replace this with a persistent logger if needed
  console.info(`[WALLET AUDIT] action=${action} userId=${userId} meta=${JSON.stringify(meta)} stack=${stack}`);
}
  meta: any = {},
function ensureTx(tx: any) {
  if (!tx || typeof tx !== 'object' || typeof tx.$executeRaw !== 'function') {
    throw new Error('Wallet mutation must be called inside a transaction context');
  }
}
  tx: Prisma.TransactionClient = prisma
// Only export these safe wallet functions
export async function credit(userId: string, amount: Prisma.Decimal, meta: any = {}, tx: Prisma.TransactionClient) {
  ensureTx(tx);
  assertDecimal(amount, 'credit.amount');
  logWalletMutation('credit', userId, meta);
  // Use safe_update_wallet SQL function
  await tx.$executeRaw`SELECT safe_update_wallet(${userId}, ${amount}, 0)`;
  await logAudit({ userId, action: "credit", details: { amount, meta }, tx });
  // Optionally add bonus/fraud logic here
  return tx.wallet.findUnique({ where: { userId } });
}

export async function debit(userId: string, amount: Prisma.Decimal, meta: any = {}, tx: Prisma.TransactionClient) {
  ensureTx(tx);
  assertDecimal(amount, 'debit.amount');
  logWalletMutation('debit', userId, meta);
  // Use safe_update_wallet SQL function (negative cash change)
  await tx.$executeRaw`SELECT safe_update_wallet(${userId}, ${amount.neg()}, 0)`;
  await logAudit({ userId, action: "debit", details: { amount, meta }, tx });
  return tx.wallet.findUnique({ where: { userId } });
}

export async function transfer(fromUserId: string, toUserId: string, amount: Prisma.Decimal, meta: any = {}, tx: Prisma.TransactionClient) {
  ensureTx(tx);
  assertDecimal(amount, 'transfer.amount');
  logWalletMutation('transfer', fromUserId, { toUserId, ...meta });
  // Debit from sender
  await tx.$executeRaw`SELECT safe_update_wallet(${fromUserId}, ${amount.neg()}, 0)`;
  // Credit to receiver
  await tx.$executeRaw`SELECT safe_update_wallet(${toUserId}, ${amount}, 0)`;
  await logAudit({ userId: fromUserId, action: "transfer_out", details: { toUserId, amount, meta }, tx });
  await logAudit({ userId: toUserId, action: "transfer_in", details: { fromUserId, amount, meta }, tx });
  return {
    from: await tx.wallet.findUnique({ where: { userId: fromUserId } }),
    to: await tx.wallet.findUnique({ where: { userId: toUserId } })
  };
}

export async function applyReward(userId: string, cashChange: Prisma.Decimal, bonusChange: Prisma.Decimal, meta: any = {}, tx: Prisma.TransactionClient) {
  ensureTx(tx);
  assertDecimal(cashChange, 'applyReward.cashChange');
  assertDecimal(bonusChange, 'applyReward.bonusChange');
  logWalletMutation('applyReward', userId, meta);
  await tx.$executeRaw`SELECT safe_update_wallet(${userId}, ${cashChange}, ${bonusChange})`;
  await logAudit({ userId, action: "applyReward", details: { cashChange, bonusChange, meta }, tx });
  return tx.wallet.findUnique({ where: { userId } });
}
) {
}