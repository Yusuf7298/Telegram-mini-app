"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReferralCode = getReferralCode;
exports.useReferralCode = useReferralCode;
const db_1 = require("../../config/db");
const referral_service_1 = require("../../services/referral.service");
const suspiciousActionLog_service_1 = require("../../services/suspiciousActionLog.service");
const apiResponse_1 = require("../../utils/apiResponse");
function getRequestUserId(req) {
    return req.userId;
}
async function getReferralCode(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (!userId)
            return res.status(401).json((0, apiResponse_1.errorResponse)("Unauthorized"));
        const user = await db_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return res.status(404).json((0, apiResponse_1.errorResponse)("User not found"));
        return res.json((0, apiResponse_1.successResponse)({ referralCode: user.referralCode }));
    }
    catch {
        return res.status(500).json((0, apiResponse_1.errorResponse)("Failed to get referral code"));
    }
}
async function useReferralCode(req, res) {
    try {
        const userId = getRequestUserId(req);
        const { referralCode, deviceId } = req.body;
        const ip = req.ip || "unknown";
        if (!userId || !referralCode) {
            return res.status(400).json((0, apiResponse_1.errorResponse)("Missing user or referral code"));
        }
        const user = await db_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return res.status(404).json((0, apiResponse_1.errorResponse)("User not found"));
        if (user.referralCode === referralCode)
            return res.status(400).json((0, apiResponse_1.errorResponse)("Cannot refer yourself"));
        if (user.referredById)
            return res.status(400).json((0, apiResponse_1.errorResponse)("Referral already used"));
        const referrer = await db_1.prisma.user.findFirst({ where: { referralCode } });
        if (!referrer)
            return res.status(404).json((0, apiResponse_1.errorResponse)("Invalid referral code"));
        const existingLog = await db_1.prisma.referralLog.findUnique({
            where: { referrerId_referredId: { referrerId: referrer.id, referredId: user.id } },
        });
        if (existingLog)
            return res.status(400).json((0, apiResponse_1.errorResponse)("Duplicate referral"));
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
            return res.status(429).json((0, apiResponse_1.errorResponse)("Referral limit exceeded. Try again later."));
        }
        await db_1.prisma.user.update({
            where: { id: user.id },
            data: {
                referredBy: { connect: { id: referrer.id } },
                referralRewardPending: true,
                referralActivityMet: false,
            },
        });
        return res.json((0, apiResponse_1.successResponse)({}));
    }
    catch {
        return res.status(500).json((0, apiResponse_1.errorResponse)("Failed to use referral code"));
    }
}
