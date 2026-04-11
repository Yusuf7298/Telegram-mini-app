"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.depositCash = depositCash;
exports.spendCash = spendCash;
exports.creditBonus = creditBonus;
exports.creditCash = creditCash;
const db_1 = require("../config/db");
const assertDecimal_1 = require("../utils/assertDecimal");
const idempotency_service_1 = require("./idempotency.service");
// Utility to get wallet and assert existence
async function getWallet(tx, userId) {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet)
        throw new Error("Wallet not found");
    return wallet;
}
// Deposit cash into wallet (idempotent)
async function depositCash(userId, amount, idempotencyKey) {
    (0, assertDecimal_1.assertDecimal)(amount, "depositCash.amount");
    return db_1.prisma.$transaction(async (tx) => {
        // Idempotency
        let idempKey;
        try {
            idempKey = await (0, idempotency_service_1.createIdempotencyKey)({ id: idempotencyKey, userId, action: "depositCash", tx });
        }
        catch (err) {
            idempKey = await (0, idempotency_service_1.checkIdempotencyKey)({ id: idempotencyKey, userId, tx });
            if (idempKey && idempKey.status === "COMPLETED")
                return idempKey.rewardAmount;
            throw err;
        }
        const wallet = await getWallet(tx, userId);
        const before = wallet.cashBalance.plus(wallet.bonusBalance);
        const nextCash = wallet.cashBalance.plus(amount);
        if (nextCash.lt(0))
            throw new Error("Negative cash balance");
        const updated = await tx.wallet.update({ where: { userId }, data: { cashBalance: nextCash } });
        await tx.transaction.create({
            data: {
                userId,
                type: "BOX_REWARD",
                amount,
                balanceBefore: before,
                balanceAfter: updated.cashBalance.plus(updated.bonusBalance),
                meta: { op: "depositCash" },
            },
        });
        await (0, idempotency_service_1.completeIdempotencyKey)({ id: idempotencyKey, userId, response: updated, tx });
        return updated;
    });
}
// Spend cash from wallet (idempotent)
async function spendCash(userId, amount, idempotencyKey) {
    (0, assertDecimal_1.assertDecimal)(amount, "spendCash.amount");
    return db_1.prisma.$transaction(async (tx) => {
        let idempKey;
        try {
            idempKey = await (0, idempotency_service_1.createIdempotencyKey)({ id: idempotencyKey, userId, action: "spendCash", tx });
        }
        catch (err) {
            idempKey = await (0, idempotency_service_1.checkIdempotencyKey)({ id: idempotencyKey, userId, tx });
            if (idempKey && idempKey.status === "COMPLETED")
                return idempKey.rewardAmount;
            throw err;
        }
        const wallet = await getWallet(tx, userId);
        const before = wallet.cashBalance.plus(wallet.bonusBalance);
        if (wallet.cashBalance.lt(amount))
            throw new Error("Insufficient cash balance");
        const nextCash = wallet.cashBalance.minus(amount);
        if (nextCash.lt(0))
            throw new Error("Negative cash balance");
        const updated = await tx.wallet.update({ where: { userId }, data: { cashBalance: nextCash } });
        await tx.transaction.create({
            data: {
                userId,
                type: "BOX_PURCHASE",
                amount: amount.neg(),
                balanceBefore: before,
                balanceAfter: updated.cashBalance.plus(updated.bonusBalance),
                meta: { op: "spendCash" },
            },
        });
        await (0, idempotency_service_1.completeIdempotencyKey)({ id: idempotencyKey, userId, response: updated, tx });
        return updated;
    });
}
// Credit bonus to wallet (idempotent)
async function creditBonus(userId, amount, idempotencyKey) {
    (0, assertDecimal_1.assertDecimal)(amount, "creditBonus.amount");
    return db_1.prisma.$transaction(async (tx) => {
        let idempKey;
        try {
            idempKey = await (0, idempotency_service_1.createIdempotencyKey)({ id: idempotencyKey, userId, action: "creditBonus", tx });
        }
        catch (err) {
            idempKey = await (0, idempotency_service_1.checkIdempotencyKey)({ id: idempotencyKey, userId, tx });
            if (idempKey && idempKey.status === "COMPLETED")
                return idempKey.rewardAmount;
            throw err;
        }
        const wallet = await getWallet(tx, userId);
        const before = wallet.cashBalance.plus(wallet.bonusBalance);
        const nextBonus = wallet.bonusBalance.plus(amount);
        if (nextBonus.lt(0))
            throw new Error("Negative bonus balance");
        const updated = await tx.wallet.update({ where: { userId }, data: { bonusBalance: nextBonus } });
        await tx.transaction.create({
            data: {
                userId,
                type: "WELCOME_BONUS",
                amount,
                balanceBefore: before,
                balanceAfter: updated.cashBalance.plus(updated.bonusBalance),
                meta: { op: "creditBonus" },
            },
        });
        await (0, idempotency_service_1.completeIdempotencyKey)({ id: idempotencyKey, userId, response: updated, tx });
        return updated;
    });
}
// Credit cash to wallet (idempotent)
async function creditCash(userId, amount, idempotencyKey) {
    (0, assertDecimal_1.assertDecimal)(amount, "creditCash.amount");
    return db_1.prisma.$transaction(async (tx) => {
        let idempKey;
        try {
            idempKey = await (0, idempotency_service_1.createIdempotencyKey)({ id: idempotencyKey, userId, action: "creditCash", tx });
        }
        catch (err) {
            idempKey = await (0, idempotency_service_1.checkIdempotencyKey)({ id: idempotencyKey, userId, tx });
            if (idempKey && idempKey.status === "COMPLETED")
                return idempKey.rewardAmount;
            throw err;
        }
        const wallet = await getWallet(tx, userId);
        const before = wallet.cashBalance.plus(wallet.bonusBalance);
        const nextCash = wallet.cashBalance.plus(amount);
        if (nextCash.lt(0))
            throw new Error("Negative cash balance");
        const updated = await tx.wallet.update({ where: { userId }, data: { cashBalance: nextCash } });
        await tx.transaction.create({
            data: {
                userId,
                type: "BOX_REWARD",
                amount,
                balanceBefore: before,
                balanceAfter: updated.cashBalance.plus(updated.bonusBalance),
                meta: { op: "creditCash" },
            },
        });
        await (0, idempotency_service_1.completeIdempotencyKey)({ id: idempotencyKey, userId, response: updated, tx });
        return updated;
    });
}
