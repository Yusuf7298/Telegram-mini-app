"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReferralCode = getReferralCode;
exports.getReferralList = getReferralList;
exports.useReferralCode = useReferralCode;
const db_1 = require("../../config/db");
const client_1 = require("@prisma/client");
const referral_service_1 = require("../../services/referral.service");
const suspiciousActionLog_service_1 = require("../../services/suspiciousActionLog.service");
const responder_1 = require("../../utils/responder");
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
async function getReferralCode(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (!userId)
            return (0, responder_1.failure)(res, "UNAUTHORIZED", "Unauthorized");
        const user = await db_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return (0, responder_1.failure)(res, "NOT_FOUND", "User not found");
        return (0, responder_1.success)(res, { referralCode: user.referralCode });
    }
    catch {
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", "Failed to get referral code");
    }
}
function toSafeNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string") {
        const parsed = Number(value.trim());
        return Number.isFinite(parsed) ? parsed : 0;
    }
    if (value instanceof client_1.Prisma.Decimal) {
        return value.toNumber();
    }
    return 0;
}
function extractReferredUserId(meta) {
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
        return null;
    }
    const candidate = meta;
    return typeof candidate.referredUserId === "string" ? candidate.referredUserId : null;
}
async function getReferralList(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (!userId) {
            return (0, responder_1.failure)(res, "UNAUTHORIZED", "Unauthorized");
        }
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                referrals: {
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true,
                        username: true,
                        createdAt: true,
                        referralStatus: true,
                    },
                },
                transactions: {
                    where: { type: "REFERRAL" },
                    select: {
                        amount: true,
                        meta: true,
                    },
                },
            },
        });
        if (!user) {
            return (0, responder_1.failure)(res, "NOT_FOUND", "User not found");
        }
        const rewardByReferredUserId = new Map();
        for (const transaction of user.transactions) {
            const referredUserId = extractReferredUserId(transaction.meta);
            if (!referredUserId) {
                continue;
            }
            rewardByReferredUserId.set(referredUserId, (rewardByReferredUserId.get(referredUserId) ?? 0) + toSafeNumber(transaction.amount));
        }
        const referrals = user.referrals.map((referral) => {
            const status = referral.referralStatus === "ACTIVE"
                ? "active"
                : referral.referralStatus === "JOINED"
                    ? "joined"
                    : "pending";
            const reward = status === "active" ? rewardByReferredUserId.get(referral.id) ?? 0 : 0;
            return {
                user: referral.username?.trim() || `User ${referral.id.slice(0, 6)}`,
                status,
                reward,
            };
        });
        const totals = referrals.reduce((accumulator, referral) => {
            if (referral.status === "active") {
                accumulator.activeReferrals += 1;
                accumulator.totalEarned += referral.reward;
            }
            return accumulator;
        }, {
            activeReferrals: 0,
            totalEarned: 0,
        });
        return (0, responder_1.success)(res, {
            referrals,
            totals,
        });
    }
    catch {
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", "Failed to fetch referral list");
    }
}
async function useReferralCode(req, res) {
    try {
        const userId = getRequestUserId(req);
        const { referralCode, deviceId } = req.body;
        const ip = req.ip || "unknown";
        if (!userId || !referralCode) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "Missing user or referral code");
        }
        const result = await (0, referral_service_1.applyReferralCode)({
            referredUserId: userId,
            referralCode,
            ip,
            deviceId,
        });
        const resultWithWalletSnapshot = await ensureWalletSnapshotInResponseData(result, userId);
        return (0, responder_1.success)(res, resultWithWalletSnapshot);
    }
    catch (error) {
        if (error instanceof referral_service_1.ReferralServiceError) {
            if (error.code === "RATE_LIMIT") {
                await (0, suspiciousActionLog_service_1.logSuspiciousAction)({
                    userId: getRequestUserId(req) || "system",
                    type: "referral_fraud",
                    metadata: {
                        referralCode: req.body?.referralCode,
                        ip: req.ip || "unknown",
                        deviceId: req.body?.deviceId || "unknown",
                    },
                });
            }
            return (0, responder_1.failure)(res, error.code, error.message);
        }
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", "Failed to use referral code");
    }
}
