"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferralServiceError = void 0;
exports.logReferral = logReferral;
exports.checkReferralLimits = checkReferralLimits;
exports.applyReferralCode = applyReferralCode;
// NEW: Referral protection service
const db_1 = require("../config/db");
const client_1 = require("@prisma/client");
const logger_1 = require("./logger");
const MAX_REFERRALS_PER_IP_PER_DAY = 5;
class ReferralServiceError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
exports.ReferralServiceError = ReferralServiceError;
async function logReferral({ referrerId, referredId, ip, deviceId, suspicious, tx, }) {
    const client = tx || db_1.prisma;
    await client.referralLog.create({
        data: { referrerId, referredId, ip, deviceId, suspicious: !!suspicious },
    });
}
async function checkReferralLimits({ ip, deviceId, referrerId, referredId, tx, }) {
    const client = tx || db_1.prisma;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const countByIp = await client.referralLog.count({
        where: {
            ip,
            createdAt: { gte: since },
        },
    });
    if (countByIp >= MAX_REFERRALS_PER_IP_PER_DAY) {
        return false;
    }
    if (referrerId && referredId) {
        const [referrer, referred] = await Promise.all([
            client.user.findUnique({ where: { id: referrerId }, select: { deviceHash: true, createdIp: true } }),
            client.user.findUnique({ where: { id: referredId }, select: { deviceHash: true, createdIp: true } }),
        ]);
        if (!referrer || !referred)
            return false;
        if (referrer.createdIp === referred.createdIp)
            return false;
        if (referrer.deviceHash && referred.deviceHash && referrer.deviceHash === referred.deviceHash) {
            return false;
        }
    }
    if (deviceId) {
        const countByDevice = await client.referralLog.count({
            where: {
                deviceId,
                createdAt: { gte: since },
            },
        });
        if (countByDevice >= MAX_REFERRALS_PER_IP_PER_DAY) {
            return false;
        }
    }
    return true;
}
async function applyReferralCode({ referredUserId, referralCode, ip, deviceId, }) {
    const normalizedCode = referralCode.trim().toUpperCase();
    if (!normalizedCode) {
        throw new ReferralServiceError("INVALID_INPUT", "Referral code is required");
    }
    return db_1.prisma.$transaction(async (tx) => {
        const invitedUser = await tx.user.findUnique({
            where: { id: referredUserId },
            select: {
                id: true,
                referredById: true,
                referralStatus: true,
                referralJoinedAt: true,
                referralActivatedAt: true,
            },
        });
        if (!invitedUser) {
            throw new ReferralServiceError("NOT_FOUND", "User not found");
        }
        const inviter = await tx.user.findUnique({
            where: { referralCode: normalizedCode },
            select: {
                id: true,
                referralCount: true,
                wallet: {
                    select: {
                        bonusBalance: true,
                    },
                },
            },
        });
        if (!inviter) {
            throw new ReferralServiceError("NOT_FOUND", "Invalid referral code");
        }
        if (inviter.id === invitedUser.id) {
            throw new ReferralServiceError("INVALID_INPUT", "Cannot refer yourself");
        }
        if (invitedUser.referredById) {
            throw new ReferralServiceError("INVALID_INPUT", "Referral already used");
        }
        const duplicateReferral = await tx.referralLog.findUnique({
            where: {
                referrerId_referredId: {
                    referrerId: inviter.id,
                    referredId: invitedUser.id,
                },
            },
            select: { id: true },
        });
        if (duplicateReferral) {
            throw new ReferralServiceError("INVALID_INPUT", "Duplicate referral");
        }
        const safeDeviceId = deviceId?.trim() || "unknown";
        const allowed = await checkReferralLimits({
            ip,
            deviceId: safeDeviceId,
            referrerId: inviter.id,
            referredId: invitedUser.id,
            tx,
        });
        await logReferral({
            referrerId: inviter.id,
            referredId: invitedUser.id,
            ip,
            deviceId: safeDeviceId,
            suspicious: !allowed,
            tx,
        });
        if (!allowed) {
            throw new ReferralServiceError("RATE_LIMIT", "Referral limit exceeded. Try again later.");
        }
        const updatedInviter = await tx.user.update({
            where: { id: inviter.id },
            data: {
                referralCount: { increment: 1 },
            },
            select: {
                id: true,
                referralCount: true,
            },
        });
        const updatedInvitedUser = await tx.user.update({
            where: { id: invitedUser.id },
            data: {
                referredBy: { connect: { id: inviter.id } },
                freeBoxUsed: false,
                referralStatus: "JOINED",
                referralJoinedAt: new Date(),
                referralActivatedAt: null,
            },
            select: {
                id: true,
                referredById: true,
                referralStatus: true,
                referralJoinedAt: true,
                referralActivatedAt: true,
            },
        });
        const invitedUserWallet = await tx.wallet.findUnique({
            where: { userId: invitedUser.id },
            select: {
                cashBalance: true,
                bonusBalance: true,
            },
        });
        if (!invitedUserWallet) {
            throw new ReferralServiceError("NOT_FOUND", "Wallet not found");
        }
        let updatedInviterBonusBalance = inviter.wallet?.bonusBalance ?? new client_1.Prisma.Decimal(0);
        await (0, logger_1.logStructuredEvent)("referral_joined", {
            userId: invitedUser.id,
            endpoint: "referral/use",
            action: "referral_joined",
            referrerId: inviter.id,
            referralCode: normalizedCode,
            ip,
            deviceId: safeDeviceId,
            referralStatus: "JOINED",
        });
        return {
            referralCode: normalizedCode,
            walletSnapshot: {
                cashBalance: invitedUserWallet.cashBalance.toString(),
                bonusBalance: invitedUserWallet.bonusBalance.toString(),
                airtimeBalance: "0",
            },
            inviter: {
                id: updatedInviter.id,
                referralCount: updatedInviter.referralCount,
                bonusBalance: updatedInviterBonusBalance.toString(),
            },
            invitedUser: {
                id: updatedInvitedUser.id,
                referredById: updatedInvitedUser.referredById ?? inviter.id,
                referralStatus: updatedInvitedUser.referralStatus,
                referralJoinedAt: updatedInvitedUser.referralJoinedAt,
                referralActivatedAt: updatedInvitedUser.referralActivatedAt,
            },
            rewards: {
                invitedFreeBoxGranted: false,
                inviterBonusGranted: false,
                inviterBonusAmount: "0",
            },
            usage: {
                applied: true,
                suspicious: !allowed,
            },
        };
    });
}
