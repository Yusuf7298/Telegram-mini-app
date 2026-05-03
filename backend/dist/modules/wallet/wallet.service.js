"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.depositWallet = depositWallet;
exports.withdrawWallet = withdrawWallet;
exports.checkWalletIntegrity = checkWalletIntegrity;
exports.credit = credit;
exports.debit = debit;
exports.transfer = transfer;
exports.applyReward = applyReward;
const client_1 = require("@prisma/client");
const db_1 = require("../../config/db");
const lock_1 = require("../../utils/lock");
const withTransactionRetry_1 = require("../../services/withTransactionRetry");
const idempotency_service_1 = require("../../services/idempotency.service");
const suspiciousActionLog_service_1 = require("../../services/suspiciousActionLog.service");
const logger_1 = require("../../services/logger");
const fraudDetection_service_1 = require("../../services/fraudDetection.service");
const auditLog_service_1 = require("../../services/auditLog.service");
const rules_service_1 = require("../../services/rules.service");
const numbers_1 = require("../../constants/numbers");
function toDecimal(value) {
    return value instanceof client_1.Prisma.Decimal ? value : new client_1.Prisma.Decimal(value);
}
async function depositWallet(userId, amountInput, idempotencyKey) {
    const amount = toDecimal(amountInput);
    if (amount.lte(numbers_1.ZERO))
        throw new Error("Amount must be greater than zero");
    return (0, lock_1.withUserLock)(userId, async () => {
        return (0, withTransactionRetry_1.withTransactionRetry)(db_1.prisma, async (tx) => {
            await (0, logger_1.logStructuredEvent)("financial_operation", {
                userId,
                action: "deposit_attempt",
                amount: amount.toString(),
                idempotencyKey,
                timestamp: new Date().toISOString(),
            });
            const existing = await (0, idempotency_service_1.checkIdempotencyKey)({ id: idempotencyKey, userId, tx });
            if (existing?.status === "COMPLETED") {
                await (0, logger_1.logStructuredEvent)("financial_operation", {
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
                await (0, idempotency_service_1.createIdempotencyKey)({ id: idempotencyKey, userId, action: "walletDeposit", tx });
            }
            catch (err) {
                const duplicate = await (0, idempotency_service_1.checkIdempotencyKey)({ id: idempotencyKey, userId, tx });
                if (duplicate?.status === "COMPLETED") {
                    return duplicate.response;
                }
                if (duplicate?.status === "PENDING") {
                    throw new Error("Idempotent request is still processing");
                }
                throw err;
            }
            const wallet = await tx.wallet.findUnique({ where: { userId } });
            if (!wallet)
                throw new Error("Wallet not found");
            const before = wallet.cashBalance.plus(wallet.bonusBalance);
            const nextCash = wallet.cashBalance.plus(amount);
            await (0, logger_1.logStructuredEvent)("financial_operation", {
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
            await (0, logger_1.logStructuredEvent)("financial_operation", {
                userId,
                action: "deposit_mutation_after",
                amount: amount.toString(),
                idempotencyKey,
                timestamp: new Date().toISOString(),
            });
            if (updated.count === numbers_1.ZERO) {
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
            if (!walletAfter)
                throw new Error("Wallet not found");
            const completedResponse = await (0, idempotency_service_1.completeIdempotencyKey)({
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
            await (0, logger_1.logStructuredEvent)("financial_operation", {
                userId,
                action: "deposit_success",
                amount: amount.toString(),
                idempotencyKey,
                timestamp: new Date().toISOString(),
            });
            return completedResponse;
        });
    }).catch(async (err) => {
        await (0, logger_1.logStructuredEvent)("financial_operation", {
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
async function withdrawWallet(userId, amountInput, idempotencyKey) {
    const amount = toDecimal(amountInput);
    if (amount.lte(numbers_1.ZERO))
        throw new Error("Amount must be greater than zero");
    return (0, lock_1.withUserLock)(userId, async () => {
        return (0, withTransactionRetry_1.withTransactionRetry)(db_1.prisma, async (tx) => {
            await (0, logger_1.logStructuredEvent)("financial_operation", {
                userId,
                action: "withdraw_attempt",
                amount: amount.toString(),
                idempotencyKey,
                timestamp: new Date().toISOString(),
            });
            const existing = await (0, idempotency_service_1.checkIdempotencyKey)({ id: idempotencyKey, userId, tx });
            if (existing?.status === "COMPLETED") {
                await (0, logger_1.logStructuredEvent)("financial_operation", {
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
                await (0, idempotency_service_1.createIdempotencyKey)({ id: idempotencyKey, userId, action: "walletWithdraw", tx });
            }
            catch (err) {
                const duplicate = await (0, idempotency_service_1.checkIdempotencyKey)({ id: idempotencyKey, userId, tx });
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
            const latestReward = await tx.transaction.findFirst({
                where: { userId, type: "BOX_REWARD" },
                orderBy: { createdAt: "desc" },
                select: { createdAt: true },
            });
            const withdrawRule = await (0, rules_service_1.canUserWithdraw)({
                user,
                lastRewardAt: latestReward?.createdAt ?? null,
                client: tx,
            });
            if (!withdrawRule.allowed) {
                await (0, suspiciousActionLog_service_1.logSuspiciousAction)({
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
                if (withdrawRule.reason === "frozen_account_withdraw_attempt" ||
                    withdrawRule.reason === "high_risk_withdraw_attempt") {
                    throw new Error("Withdrawals are restricted for this account");
                }
                if (withdrawRule.reason === "minimum_play_requirement_not_met") {
                    throw new Error("Minimum gameplay activity required before withdrawal");
                }
                if (withdrawRule.reason === "reward_cooldown") {
                    throw new Error("Withdrawal is temporarily locked after recent rewards");
                }
            }
            const wallet = await tx.wallet.findUnique({ where: { userId } });
            if (!wallet)
                throw new Error("Wallet not found");
            const withdrawSuspicion = await (0, fraudDetection_service_1.recordWithdrawAttempt)(userId);
            if (withdrawSuspicion.isSuspicious) {
                await (0, logger_1.logStructuredEvent)("fraud_detected", {
                    userId,
                    reason: withdrawSuspicion.reason,
                    type: "withdraw_frequency",
                    amount: amount.toString(),
                    idempotencyKey,
                    timestamp: new Date().toISOString(),
                });
            }
            const withdrawableBonus = wallet.bonusLocked ? new client_1.Prisma.Decimal(numbers_1.ZERO) : wallet.bonusBalance;
            const withdrawableTotal = wallet.cashBalance.plus(withdrawableBonus);
            if (withdrawableTotal.lt(amount))
                throw new Error("Insufficient withdrawable balance");
            const before = wallet.cashBalance.plus(wallet.bonusBalance);
            const cashUsed = wallet.cashBalance.gte(amount) ? amount : wallet.cashBalance;
            const bonusUsed = amount.minus(cashUsed);
            const nextCash = wallet.cashBalance.minus(cashUsed);
            const nextBonus = wallet.bonusBalance.minus(bonusUsed);
            await (0, logger_1.logStructuredEvent)("financial_operation", {
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
            await (0, logger_1.logStructuredEvent)("financial_operation", {
                userId,
                action: "withdraw_mutation_after",
                amount: amount.toString(),
                idempotencyKey,
                timestamp: new Date().toISOString(),
            });
            if (updated.count === numbers_1.ZERO) {
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
            await (0, auditLog_service_1.logAudit)({
                userId,
                action: "wallet_withdraw",
                details: {
                    amount: amount.toString(),
                    cashUsed: cashUsed.toString(),
                    bonusUsed: bonusUsed.toString(),
                    idempotencyKey,
                },
                tx,
            });
            const walletAfter = await tx.wallet.findUnique({ where: { userId } });
            if (!walletAfter)
                throw new Error("Wallet not found");
            const completedResponse = await (0, idempotency_service_1.completeIdempotencyKey)({
                id: idempotencyKey,
                userId,
                response: {
                    walletSnapshot: {
                        cashBalance: walletAfter.cashBalance,
                        bonusBalance: walletAfter.bonusBalance,
                        airtimeBalance: numbers_1.ZERO,
                    },
                    cashBalance: walletAfter.cashBalance,
                    bonusBalance: walletAfter.bonusBalance,
                    airtimeBalance: numbers_1.ZERO,
                },
                metadata: {
                    action: "walletWithdraw",
                    amount: amount.toString(),
                    walletSnapshot: {
                        cashBalance: walletAfter.cashBalance,
                        bonusBalance: walletAfter.bonusBalance,
                        airtimeBalance: numbers_1.ZERO,
                    },
                },
                tx,
            });
            await (0, logger_1.logStructuredEvent)("financial_operation", {
                userId,
                action: "withdraw_success",
                amount: amount.toString(),
                idempotencyKey,
                timestamp: new Date().toISOString(),
            });
            return completedResponse;
        });
    }).catch(async (err) => {
        await (0, logger_1.logStructuredEvent)("financial_operation", {
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
async function checkWalletIntegrity(userId) {
    const wallet = await db_1.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet)
        return false;
    return wallet.cashBalance.gte(numbers_1.ZERO) && wallet.bonusBalance.gte(numbers_1.ZERO);
}
async function credit(userId, amount, _meta = {}, tx) {
    if (amount.lte(numbers_1.ZERO))
        throw new Error("Amount must be greater than zero");
    await tx.wallet.update({ where: { userId }, data: { cashBalance: { increment: amount } } });
    return tx.wallet.findUnique({ where: { userId } });
}
async function debit(userId, amount, _meta = {}, tx) {
    if (amount.lte(numbers_1.ZERO))
        throw new Error("Amount must be greater than zero");
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.cashBalance.lt(amount))
        throw new Error("Insufficient cash balance");
    await tx.wallet.update({ where: { userId }, data: { cashBalance: { decrement: amount } } });
    return tx.wallet.findUnique({ where: { userId } });
}
async function transfer(fromUserId, toUserId, amount, _meta = {}, tx) {
    await debit(fromUserId, amount, {}, tx);
    await credit(toUserId, amount, {}, tx);
    return {
        from: await tx.wallet.findUnique({ where: { userId: fromUserId } }),
        to: await tx.wallet.findUnique({ where: { userId: toUserId } }),
    };
}
async function applyReward(userId, cashChange, bonusChange, _meta = {}, tx) {
    await tx.wallet.update({
        where: { userId },
        data: {
            cashBalance: { increment: cashChange },
            bonusBalance: { increment: bonusChange },
        },
    });
    return tx.wallet.findUnique({ where: { userId } });
}
