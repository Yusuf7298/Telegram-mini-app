import { assertDecimal } from '../utils/assertDecimal';
// NEW: Admin controls for freeze/unfreeze/revokeReward
import { prisma } from "../config/db";
import { logAudit } from "./auditLog.service";
import { Prisma } from "@prisma/client";

export async function freezeUser(userId: string, tx?: Prisma.TransactionClient) {
  const client = tx || prisma;
  await client.user.update({ where: { id: userId }, data: { isFrozen: true } });
  await logAudit({ userId, action: "freezeUser", details: {}, tx: client });
}

export async function unfreezeUser(userId: string, tx?: Prisma.TransactionClient) {
  const client = tx || prisma;
  await client.user.update({ where: { id: userId }, data: { isFrozen: false } });
  await logAudit({ userId, action: "unfreezeUser", details: {}, tx: client });
}

export async function revokeReward(transactionId: string, reason: string, tx?: Prisma.TransactionClient) {
  const client = tx || prisma;
  const txn = await client.transaction.findUnique({ where: { id: transactionId } });
  if (!txn) throw new Error("Transaction not found");
  // UPDATED: Only allow revoking rewards, not purchases
  if (txn.type !== "BOX_REWARD" && txn.type !== "REFERRAL" && txn.type !== "VAULT_REWARD" && txn.type !== "WELCOME_BONUS") {
    throw new Error("Can only revoke reward transactions");
  }
  // UPDATED: Reverse wallet update safely
  assertDecimal(txn.amount, 'admin.revokeReward.amount');
  await client.wallet.update({
    where: { userId: txn.userId },
    data: { cashBalance: { decrement: txn.amount } },
  });
  await client.rewardRevocation.create({
    data: { userId: txn.userId, rewardId: transactionId, reason },
  });
  await logAudit({ userId: txn.userId, action: "revokeReward", details: { transactionId, reason }, tx: client });
}
