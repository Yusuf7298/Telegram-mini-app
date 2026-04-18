"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWallet = getWallet;
exports.depositToWallet = depositToWallet;
exports.withdrawFromWallet = withdrawFromWallet;
exports.getWalletTransactions = getWalletTransactions;
exports.getTransactions = getTransactions;
const db_1 = require("../../config/db");
const wallet_service_1 = require("./wallet.service");
const client_1 = require("@prisma/client");
const responder_1 = require("../../utils/responder");
const idempotencyKey_1 = require("../../utils/idempotencyKey");
const logger_1 = require("../../services/logger");
function getRequestUserId(req) {
    return req.userId;
}
async function ensureWalletSnapshotInResponseData(payload, userId) {
    if (payload && typeof payload === "object") {
        const data = payload;
        if (data.walletSnapshot && typeof data.walletSnapshot === "object") {
            return payload;
        }
    }
    const wallet = await db_1.prisma.wallet.findUnique({
        where: { userId },
        select: {
            cashBalance: true,
            bonusBalance: true,
        },
    });
    if (!wallet) {
        return payload;
    }
    const walletSnapshot = {
        cashBalance: wallet.cashBalance,
        bonusBalance: wallet.bonusBalance,
        airtimeBalance: 0,
    };
    if (payload && typeof payload === "object") {
        return {
            ...payload,
            walletSnapshot,
        };
    }
    return { walletSnapshot };
}
function parsePositiveDecimal(value) {
    try {
        const normalized = typeof value === "number" || typeof value === "string"
            ? value
            : null;
        if (normalized === null) {
            return null;
        }
        const decimal = new client_1.Prisma.Decimal(normalized);
        if (decimal.lte(0))
            return null;
        return decimal;
    }
    catch {
        return null;
    }
}
async function getWallet(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (typeof userId !== "string" || !userId.trim()) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "userId is required");
        }
        const wallet = await db_1.prisma.wallet.findUnique({ where: { userId } });
        if (!wallet) {
            return (0, responder_1.failure)(res, "NOT_FOUND", "Wallet not found");
        }
        return (0, responder_1.success)(res, wallet);
    }
    catch (err) {
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", "Failed to fetch wallet");
    }
}
async function depositToWallet(req, res) {
    try {
        const userId = getRequestUserId(req);
        const amount = parsePositiveDecimal(req.body?.amount);
        const idempotencyKey = (0, idempotencyKey_1.extractIdempotencyKey)(req);
        if (typeof userId !== "string" || !userId.trim()) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "userId is required");
        }
        if (amount === null) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "Valid amount is required");
        }
        if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "idempotencyKey is required");
        }
        const replaySafeResponse = await (0, wallet_service_1.depositWallet)(userId, amount, idempotencyKey);
        return (0, responder_1.success)(res, replaySafeResponse.data);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to deposit funds";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function withdrawFromWallet(req, res) {
    try {
        const userId = getRequestUserId(req);
        const amount = parsePositiveDecimal(req.body?.amount);
        const idempotencyKey = (0, idempotencyKey_1.extractIdempotencyKey)(req);
        if (typeof userId !== "string" || !userId.trim()) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "userId is required");
        }
        if (amount === null) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "Valid amount is required");
        }
        if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "idempotencyKey is required");
        }
        const replaySafeResponse = await (0, wallet_service_1.withdrawWallet)(userId, amount, idempotencyKey);
        const responseDataWithWalletSnapshot = await ensureWalletSnapshotInResponseData(replaySafeResponse.data, userId);
        return (0, responder_1.success)(res, responseDataWithWalletSnapshot);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to withdraw funds";
        await (0, logger_1.logError)(err instanceof Error ? err : new Error(message), {
            endpoint: "/wallet/withdraw",
            userId: getRequestUserId(req) ?? null,
        });
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function getWalletTransactions(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (typeof userId !== "string" || !userId.trim()) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "userId is required");
        }
        const limitRaw = Number(req.query.limit);
        const limit = Number.isFinite(limitRaw)
            ? Math.min(Math.max(Math.floor(limitRaw), 1), 50)
            : 20;
        const transactions = await db_1.prisma.transaction.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: limit,
            select: {
                id: true,
                type: true,
                amount: true,
                createdAt: true,
                box: {
                    select: {
                        name: true,
                    },
                },
            },
        });
        return (0, responder_1.success)(res, transactions);
    }
    catch {
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", "Failed to fetch transactions");
    }
}
async function getTransactions(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (!userId)
            return (0, responder_1.failure)(res, "UNAUTHORIZED", "Unauthorized");
        // Pagination
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));
        const skip = (page - 1) * pageSize;
        // Filters
        const type = req.query.type;
        const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : undefined;
        const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : undefined;
        const where = { userId };
        if (type)
            where.type = type;
        if (dateFrom || dateTo)
            where.createdAt = {};
        if (dateFrom)
            where.createdAt.gte = dateFrom;
        if (dateTo)
            where.createdAt.lte = dateTo;
        // Query
        const [total, transactions] = await Promise.all([
            db_1.prisma.transaction.count({ where }),
            db_1.prisma.transaction.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: pageSize,
                select: {
                    id: true,
                    type: true,
                    amount: true,
                    balanceAfter: true,
                    createdAt: true,
                },
            }),
        ]);
        // Unity-optimized response
        return (0, responder_1.success)(res, {
            page,
            pageSize,
            total,
            transactions: transactions.map(t => ({
                id: t.id,
                type: t.type,
                amount: t.amount.toNumber(),
                balanceAfter: t.balanceAfter.toNumber(),
                createdAt: t.createdAt.toISOString(),
            })),
        });
    }
    catch (err) {
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", "Failed to fetch transactions");
    }
}
