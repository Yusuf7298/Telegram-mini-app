"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReferralCode = getReferralCode;
exports.getReferralList = getReferralList;
exports.getReferralAnalytics = getReferralAnalytics;
exports.useReferralCode = useReferralCode;
const client_1 = require("@prisma/client");
const db_1 = require("../../config/db");
const referral_service_1 = require("../../services/referral.service");
const suspiciousActionLog_service_1 = require("../../services/suspiciousActionLog.service");
const responder_1 = require("../../utils/responder");
const dbHealthGuard_middleware_1 = require("../../middleware/dbHealthGuard.middleware");
function getRequestUserId(req) {
    return req.userId;
}
function parseRewardAmount(details) {
    if (!details) {
        return new client_1.Prisma.Decimal(0);
    }
    try {
        const parsed = JSON.parse(details);
        const rewardAmount = parsed.rewardAmount;
        if (typeof rewardAmount === "string" || typeof rewardAmount === "number") {
            return new client_1.Prisma.Decimal(rewardAmount);
        }
    }
    catch {
        return new client_1.Prisma.Decimal(0);
    }
    return new client_1.Prisma.Decimal(0);
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
                        createdAt: true,
                        referralStatus: true,
                        referralRewardGrantReceived: {
                            select: {
                                amount: true,
                            },
                        },
                    },
                },
            },
        });
        if (!user) {
            return (0, responder_1.failure)(res, "NOT_FOUND", "User not found");
        }
        const referrals = user.referrals.map((referral) => {
            const referralStatus = referral.referralStatus;
            const rewardAmount = referral.referralRewardGrantReceived?.amount.toNumber() ?? 0;
            return {
                referredUserId: referral.id,
                referralStatus,
                rewardAmount,
                createdAt: referral.createdAt,
            };
        });
        const totals = referrals.reduce((accumulator, referral) => {
            if (referral.referralStatus === "ACTIVE") {
                accumulator.activeReferrals += 1;
                accumulator.totalEarned += referral.rewardAmount;
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
async function getReferralAnalytics(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (!userId) {
            return (0, responder_1.failure)(res, "UNAUTHORIZED", "Unauthorized");
        }
        const [totalReferrals, joinedCount, activeCount, referralRewards] = await Promise.all([
            db_1.prisma.user.count({
                where: {
                    referredById: userId,
                },
            }),
            db_1.prisma.user.count({
                where: {
                    referredById: userId,
                    referralStatus: "JOINED",
                },
            }),
            db_1.prisma.user.count({
                where: {
                    referredById: userId,
                    referralStatus: "ACTIVE",
                },
            }),
            db_1.prisma.auditLog.findMany({
                where: {
                    userId,
                    action: "referral_reward",
                },
                select: {
                    details: true,
                },
            }),
        ]);
        const totalRewardsDistributed = referralRewards.reduce((sum, entry) => sum.add(parseRewardAmount(entry.details)), new client_1.Prisma.Decimal(0));
        const conversionRate = joinedCount > 0 ? activeCount / joinedCount : 0;
        return (0, responder_1.success)(res, {
            totalReferrals,
            joinedCount,
            activeCount,
            conversionRate,
            totalRewardsDistributed: totalRewardsDistributed.toString(),
        });
    }
    catch {
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", "Failed to fetch referral analytics");
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
        if (await (0, dbHealthGuard_middleware_1.rejectIfDbUnhealthy)(res)) {
            return;
        }
        const result = await (0, referral_service_1.applyReferralCode)({
            referredUserId: userId,
            referralCode,
            ip,
            deviceId,
        });
        return (0, responder_1.success)(res, result);
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
