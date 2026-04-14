"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReferralCode = getReferralCode;
exports.useReferralCode = useReferralCode;
const db_1 = require("../../config/db");
const referral_service_1 = require("../../services/referral.service");
const suspiciousActionLog_service_1 = require("../../services/suspiciousActionLog.service");
const responder_1 = require("../../utils/responder");
function getRequestUserId(req) {
    return req.userId;
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
async function useReferralCode(req, res) {
    try {
        const userId = getRequestUserId(req);
        const { referralCode, deviceId } = req.body;
        const ip = req.ip || "unknown";
        if (!userId || !referralCode) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "Missing user or referral code");
        }
        const user = await db_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return (0, responder_1.failure)(res, "NOT_FOUND", "User not found");
        if (user.referralCode === referralCode)
            return (0, responder_1.failure)(res, "INVALID_INPUT", "Cannot refer yourself");
        if (user.referredById)
            return (0, responder_1.failure)(res, "INVALID_INPUT", "Referral already used");
        const referrer = await db_1.prisma.user.findFirst({ where: { referralCode } });
        if (!referrer)
            return (0, responder_1.failure)(res, "NOT_FOUND", "Invalid referral code");
        const existingLog = await db_1.prisma.referralLog.findUnique({
            where: { referrerId_referredId: { referrerId: referrer.id, referredId: user.id } },
        });
        if (existingLog)
            return (0, responder_1.failure)(res, "INVALID_INPUT", "Duplicate referral");
        const safeDeviceId = deviceId || "unknown";
        const allowed = await (0, referral_service_1.checkReferralLimits)({
            ip,
            deviceId: safeDeviceId,
            referrerId: referrer.id,
            referredId: user.id,
        });
        await (0, referral_service_1.logReferral)({
            referrerId: referrer.id,
            referredId: user.id,
            ip,
            deviceId: safeDeviceId,
            suspicious: !allowed,
        });
        if (!allowed) {
            await (0, suspiciousActionLog_service_1.logSuspiciousAction)({
                userId,
                type: "referral_fraud",
                metadata: { referrerId: referrer.id, ip, deviceId: safeDeviceId },
            });
            return (0, responder_1.failure)(res, "RATE_LIMIT", "Referral limit exceeded. Try again later.");
        }
        await db_1.prisma.user.update({
            where: { id: user.id },
            data: {
                referredBy: { connect: { id: referrer.id } },
                referralRewardPending: true,
                referralActivityMet: false,
            },
        });
        return (0, responder_1.success)(res, {});
    }
    catch {
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", "Failed to use referral code");
    }
}
