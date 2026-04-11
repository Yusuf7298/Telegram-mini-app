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
function getRequestUserId(req) {
    return req.userId;
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
            return res.status(400).json({ success: false, data: {}, error: "userId is required" });
        }
        const wallet = await db_1.prisma.wallet.findUnique({ where: { userId } });
        if (!wallet) {
            return res.status(404).json({ success: false, data: {}, error: "Wallet not found" });
        }
        return res.json({ success: true, data: wallet, error: null });
    }
    catch (err) {
        return res.status(500).json({ success: false, data: {}, error: "Failed to fetch wallet" });
    }
}
async function depositToWallet(req, res) {
    try {
        const userId = getRequestUserId(req);
        const amount = parsePositiveDecimal(req.body?.amount);
        const idempotencyKey = req.body?.idempotencyKey;
        if (typeof userId !== "string" || !userId.trim()) {
            return res.status(400).json({ success: false, error: "userId is required" });
        }
        if (amount === null) {
            return res.status(400).json({ success: false, error: "Valid amount is required" });
        }
        if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
            return res.status(400).json({ success: false, error: "idempotencyKey is required" });
        }
        const wallet = await (0, wallet_service_1.depositWallet)(userId, amount, idempotencyKey);
        return res.json({ success: true, data: wallet, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to deposit funds";
        return res.status(400).json({ success: false, error: message });
    }
}
async function withdrawFromWallet(req, res) {
    try {
        const userId = getRequestUserId(req);
        const amount = parsePositiveDecimal(req.body?.amount);
        const idempotencyKey = req.body?.idempotencyKey;
        if (typeof userId !== "string" || !userId.trim()) {
            return res.status(400).json({ success: false, error: "userId is required" });
        }
        if (amount === null) {
            return res.status(400).json({ success: false, error: "Valid amount is required" });
        }
        if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
            return res.status(400).json({ success: false, error: "idempotencyKey is required" });
        }
        const wallet = await (0, wallet_service_1.withdrawWallet)(userId, amount, idempotencyKey);
        return res.json({ success: true, data: wallet, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to withdraw funds";
        return res.status(400).json({ success: false, error: message });
    }
}
async function getWalletTransactions(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (typeof userId !== "string" || !userId.trim()) {
            return res.status(400).json({ success: false, error: "userId is required" });
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
        return res.json({ success: true, data: transactions, error: null });
    }
    catch {
        return res.status(500).json({ success: false, error: "Failed to fetch transactions" });
    }
}
async function getTransactions(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (!userId)
            return res.status(401).json({ success: false, data: {}, error: "Unauthorized" });
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
        return res.json({
            success: true,
            data: {
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
            },
            error: null,
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, data: {}, error: "Failed to fetch transactions" });
    }
}
