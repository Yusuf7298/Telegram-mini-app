import { prisma } from "../config/db";
import { Prisma } from "@prisma/client";
import { assertDecimal } from "../utils/assertDecimal";
import { createIdempotencyKey, completeIdempotencyKey, checkIdempotencyKey } from "./idempotency.service";

// Utility to get wallet and assert existence
async function getWallet(tx: Prisma.TransactionClient, userId: string) {
  const wallet = await tx.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error("Wallet not found");
  return wallet;
}

// Deposit cash into wallet (idempotent)
export async function depositCash(userId: string, amount: Prisma.Decimal, idempotencyKey: string) {
  assertDecimal(amount, "depositCash.amount");
  return prisma.$transaction(async (tx) => {
    // Idempotency
    let idempKey;
    try {
      idempKey = await createIdempotencyKey({ id: idempotencyKey, userId, action: "depositCash", tx });
    } catch (err: any) {
      idempKey = await checkIdempotencyKey({ id: idempotencyKey, userId, tx });
      if (idempKey && idempKey.status === "COMPLETED" && idempKey.response) return idempKey.response;
      throw err;
    }
    const wallet = await getWallet(tx, userId);
    const before = wallet.cashBalance.plus(wallet.bonusBalance);
    const nextCash = wallet.cashBalance.plus(amount);
    if (nextCash.lt(0)) throw new Error("Negative cash balance");
    const updated = await tx.wallet.update({ where: { userId }, data: { cashBalance: nextCash } });
    await tx.transaction.create({
      data: {
        userId,
        type: "DEPOSIT",
        amount,
        balanceBefore: before,
        balanceAfter: updated.cashBalance.plus(updated.bonusBalance),
        meta: { op: "depositCash" },
      },
    });
    await completeIdempotencyKey({ id: idempotencyKey, userId, response: updated, tx });
    return updated;
  });
}

// Spend cash from wallet (idempotent)
export async function spendCash(userId: string, amount: Prisma.Decimal, idempotencyKey: string) {
  assertDecimal(amount, "spendCash.amount");
  return prisma.$transaction(async (tx) => {
    let idempKey;
    try {
      idempKey = await createIdempotencyKey({ id: idempotencyKey, userId, action: "spendCash", tx });
    } catch (err: any) {
      idempKey = await checkIdempotencyKey({ id: idempotencyKey, userId, tx });
      if (idempKey && idempKey.status === "COMPLETED" && idempKey.response) return idempKey.response;
      throw err;
    }
    const wallet = await getWallet(tx, userId);
    const before = wallet.cashBalance.plus(wallet.bonusBalance);
    if (wallet.cashBalance.lt(amount)) throw new Error("Insufficient cash balance");
    const nextCash = wallet.cashBalance.minus(amount);
    if (nextCash.lt(0)) throw new Error("Negative cash balance");
    const updated = await tx.wallet.update({ where: { userId }, data: { cashBalance: nextCash } });
    await tx.transaction.create({
      data: {
        userId,
        type: "WITHDRAW",
        amount: amount.neg(),
        balanceBefore: before,
        balanceAfter: updated.cashBalance.plus(updated.bonusBalance),
        meta: { op: "spendCash" },
      },
    });
    await completeIdempotencyKey({ id: idempotencyKey, userId, response: updated, tx });
    return updated;
  });
}

// Credit bonus to wallet (idempotent)
export async function creditBonus(userId: string, amount: Prisma.Decimal, idempotencyKey: string) {
  assertDecimal(amount, "creditBonus.amount");
  return prisma.$transaction(async (tx) => {
    let idempKey;
    try {
      idempKey = await createIdempotencyKey({ id: idempotencyKey, userId, action: "creditBonus", tx });
    } catch (err: any) {
      idempKey = await checkIdempotencyKey({ id: idempotencyKey, userId, tx });
      if (idempKey && idempKey.status === "COMPLETED" && idempKey.response) return idempKey.response;
      throw err;
    }
    const wallet = await getWallet(tx, userId);
    const before = wallet.cashBalance.plus(wallet.bonusBalance);
    const nextBonus = wallet.bonusBalance.plus(amount);
    if (nextBonus.lt(0)) throw new Error("Negative bonus balance");
    const updated = await tx.wallet.update({ where: { userId }, data: { bonusBalance: nextBonus } });
    await tx.transaction.create({
      data: {
        userId,
        type: "BONUS",
        amount,
        balanceBefore: before,
        balanceAfter: updated.cashBalance.plus(updated.bonusBalance),
        meta: { op: "creditBonus" },
      },
    });
    await completeIdempotencyKey({ id: idempotencyKey, userId, response: updated, tx });
    return updated;
  });
}

// Credit cash to wallet (idempotent)
export async function creditCash(userId: string, amount: Prisma.Decimal, idempotencyKey: string) {
  assertDecimal(amount, "creditCash.amount");
  return prisma.$transaction(async (tx) => {
    let idempKey;
    try {
      idempKey = await createIdempotencyKey({ id: idempotencyKey, userId, action: "creditCash", tx });
    } catch (err: any) {
      idempKey = await checkIdempotencyKey({ id: idempotencyKey, userId, tx });
      if (idempKey && idempKey.status === "COMPLETED" && idempKey.response) return idempKey.response;
      throw err;
    }
    const wallet = await getWallet(tx, userId);
    const before = wallet.cashBalance.plus(wallet.bonusBalance);
    const nextCash = wallet.cashBalance.plus(amount);
    if (nextCash.lt(0)) throw new Error("Negative cash balance");
    const updated = await tx.wallet.update({ where: { userId }, data: { cashBalance: nextCash } });
    await tx.transaction.create({
      data: {
        userId,
        type: "CREDIT",
        amount,
        balanceBefore: before,
        balanceAfter: updated.cashBalance.plus(updated.bonusBalance),
        meta: { op: "creditCash" },
      },
    });
    await completeIdempotencyKey({ id: idempotencyKey, userId, response: updated, tx });
    return updated;
  });
}
