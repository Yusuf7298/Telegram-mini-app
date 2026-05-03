"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferralServiceError = void 0;
exports.logReferral = logReferral;
exports.checkReferralLimits = checkReferralLimits;
exports.applyReferralCode = applyReferralCode;
exports.activateReferralFromJoinedToActive = activateReferralFromJoinedToActive;
// NEW: Referral protection service
const db_1 = require("../config/db");
const client_1 = require("@prisma/client");
const logger_1 = require("./logger");
const auditLog_service_1 = require("./auditLog.service");
const rules_service_1 = require("./rules.service");
const numbers_1 = require("../constants/numbers");
const requestContext_service_1 = require("./requestContext.service");
const gameConfig_service_1 = require("./gameConfig.service");
const referralLogPayload_service_1 = require("./referralLogPayload.service");
class ReferralServiceError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
exports.ReferralServiceError = ReferralServiceError;
async function logReferral({ referrerId, referredId, ip, deviceId, suspicious, tx, }) {
    const client = tx || db_1.prisma;
    await client.referralLog.createMany({
        data: [{ inviterId: referrerId, referredUserId: referredId, ip, deviceId, suspicious: !!suspicious }],
        skipDuplicates: true,
    });
}
async function checkReferralLimits({ ip, deviceId, referrerId, referredId, tx, }) {
    const client = tx || db_1.prisma;
    return (0, rules_service_1.canUseReferral)({
        ip,
        deviceId,
        referrerId,
        referredId,
        client,
    });
}
async function applyReferralCode({ referredUserId, referralCode, ip, deviceId, }) {
    const normalizedCode = referralCode.trim().toUpperCase();
    if (!normalizedCode) {
        throw new ReferralServiceError("INVALID_INPUT", "Referral code is required");
    }
    return db_1.prisma.$transaction(async (tx) => {
        const correlationId = (0, requestContext_service_1.getCorrelationId)() ?? "unknown";
        const config = await (0, gameConfig_service_1.getValidatedGameConfig)({ bypassCache: true });
        const invitedUser = await tx.user.findUnique({
            where: { id: referredUserId },
            select: {
                id: true,
                telegramId: true,
                signupDeviceId: true,
                deviceHash: true,
                referredById: true,
                referralStatus: true,
                referralJoinedAt: true,
                referralActivatedAt: true,
            },
        });
        if (!invitedUser) {
            throw new ReferralServiceError("NOT_FOUND", "User not found");
        }
        const safeDeviceId = deviceId?.trim() || "unknown";
        // Idempotent path: user already has a referral relation.
        if (invitedUser.referredById) {
            const existingInviter = await tx.user.findUnique({
                where: { id: invitedUser.referredById },
                select: {
                    id: true,
                    referralCode: true,
                    referralCount: true,
                    wallet: {
                        select: {
                            bonusBalance: true,
                        },
                    },
                },
            });
            if (!existingInviter) {
                throw new ReferralServiceError("NOT_FOUND", "Referrer not found");
            }
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
            await (0, logger_1.logStructuredEvent)("referral_duplicate_blocked", (0, referralLogPayload_service_1.createReferralStructuredLogPayload)({
                event: "referral_duplicate_blocked",
                endpoint: "referral/use",
                inviterId: existingInviter.id,
                referredUserId: invitedUser.id,
                rewardAmount: numbers_1.ZERO_STRING,
                status: invitedUser.referralStatus,
                correlationId,
                referralCode: existingInviter.referralCode,
                reason: "duplicate_grant",
                detectionSource: "pre-check",
                ip,
                deviceId: safeDeviceId,
            }));
            return {
                referralCode: existingInviter.referralCode,
                walletSnapshot: {
                    cashBalance: invitedUserWallet.cashBalance.toString(),
                    bonusBalance: invitedUserWallet.bonusBalance.toString(),
                    airtimeBalance: numbers_1.ZERO_STRING,
                },
                inviter: {
                    id: existingInviter.id,
                    referralCount: existingInviter.referralCount,
                    bonusBalance: (existingInviter.wallet?.bonusBalance ?? new client_1.Prisma.Decimal(numbers_1.ZERO)).toString(),
                },
                invitedUser: {
                    id: invitedUser.id,
                    referredById: invitedUser.referredById,
                    referralStatus: invitedUser.referralStatus,
                    referralJoinedAt: invitedUser.referralJoinedAt,
                    referralActivatedAt: invitedUser.referralActivatedAt,
                },
                usage: {
                    applied: true,
                    suspicious: false,
                },
            };
        }
        const inviter = await tx.user.findUnique({
            where: { referralCode: normalizedCode },
            select: {
                id: true,
                telegramId: true,
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
        const allowed = await checkReferralLimits({
            ip,
            deviceId: safeDeviceId,
            referrerId: inviter.id,
            referredId: invitedUser.id,
            tx,
        });
        if (!allowed) {
            await (0, logger_1.logStructuredEvent)("referral_abuse_blocked", {
                userId: invitedUser.id,
                endpoint: "referral/use",
                action: "referral_abuse_blocked",
                inviterId: inviter.id,
                referredUserId: invitedUser.id,
                status: invitedUser.referralStatus,
                referralCode: normalizedCode,
                reason: "rules_limit_exceeded",
                ip,
                deviceId: safeDeviceId,
                correlationId,
            });
            throw new ReferralServiceError("RATE_LIMIT", "Referral limit exceeded. Try again later.");
        }
        // Transaction-safe write: only one concurrent request can claim the referral slot.
        const referralClaim = await tx.user.updateMany({
            where: {
                id: invitedUser.id,
                referredById: null,
            },
            data: {
                referredById: inviter.id,
                freeBoxUsed: false,
                referralStatus: "JOINED",
                referralJoinedAt: new Date(),
                referralActivatedAt: null,
            },
        });
        if (referralClaim.count === numbers_1.ZERO) {
            const alreadyLinkedUser = await tx.user.findUnique({
                where: { id: invitedUser.id },
                select: {
                    id: true,
                    referredById: true,
                    referralStatus: true,
                    referralJoinedAt: true,
                    referralActivatedAt: true,
                },
            });
            if (!alreadyLinkedUser?.referredById) {
                throw new ReferralServiceError("INVALID_INPUT", "Referral already used");
            }
            await (0, logger_1.logStructuredEvent)("referral_duplicate_blocked", (0, referralLogPayload_service_1.createReferralStructuredLogPayload)({
                event: "referral_duplicate_blocked",
                endpoint: "referral/use",
                inviterId: alreadyLinkedUser.referredById,
                referredUserId: alreadyLinkedUser.id,
                rewardAmount: numbers_1.ZERO_STRING,
                status: alreadyLinkedUser.referralStatus,
                correlationId,
                referralCode: normalizedCode,
                reason: "duplicate_grant",
                detectionSource: "post-claim",
                ip,
                deviceId: safeDeviceId,
            }));
            const existingInviter = await tx.user.findUnique({
                where: { id: alreadyLinkedUser.referredById },
                select: {
                    id: true,
                    referralCode: true,
                    referralCount: true,
                    wallet: {
                        select: {
                            bonusBalance: true,
                        },
                    },
                },
            });
            if (!existingInviter) {
                throw new ReferralServiceError("NOT_FOUND", "Referrer not found");
            }
            const invitedUserWallet = await tx.wallet.findUnique({
                where: { userId: alreadyLinkedUser.id },
                select: {
                    cashBalance: true,
                    bonusBalance: true,
                },
            });
            if (!invitedUserWallet) {
                throw new ReferralServiceError("NOT_FOUND", "Wallet not found");
            }
            return {
                referralCode: existingInviter.referralCode,
                walletSnapshot: {
                    cashBalance: invitedUserWallet.cashBalance.toString(),
                    bonusBalance: invitedUserWallet.bonusBalance.toString(),
                    airtimeBalance: numbers_1.ZERO_STRING,
                },
                inviter: {
                    id: existingInviter.id,
                    referralCount: existingInviter.referralCount,
                    bonusBalance: (existingInviter.wallet?.bonusBalance ?? new client_1.Prisma.Decimal(numbers_1.ZERO)).toString(),
                },
                invitedUser: {
                    id: alreadyLinkedUser.id,
                    referredById: alreadyLinkedUser.referredById,
                    referralStatus: alreadyLinkedUser.referralStatus,
                    referralJoinedAt: alreadyLinkedUser.referralJoinedAt,
                    referralActivatedAt: alreadyLinkedUser.referralActivatedAt,
                },
                usage: {
                    applied: true,
                    suspicious: false,
                },
            };
        }
        await logReferral({
            referrerId: inviter.id,
            referredId: invitedUser.id,
            ip,
            deviceId: safeDeviceId,
            suspicious: !allowed,
            tx,
        });
        const updatedInviter = await tx.user.update({
            where: { id: inviter.id },
            data: {
                referralCount: { increment: numbers_1.ONE },
            },
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
        const updatedInvitedUser = await tx.user.findUnique({
            where: { id: invitedUser.id },
            select: {
                id: true,
                referredById: true,
                referralStatus: true,
                referralJoinedAt: true,
                referralActivatedAt: true,
            },
        });
        if (!updatedInvitedUser?.referredById) {
            throw new ReferralServiceError("INTERNAL_ERROR", "Failed to resolve updated referral state");
        }
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
        await (0, logger_1.logStructuredEvent)("referral_joined", (0, referralLogPayload_service_1.createReferralStructuredLogPayload)({
            event: "referral_joined",
            endpoint: "referral/use",
            inviterId: inviter.id,
            referredUserId: invitedUser.id,
            rewardAmount: numbers_1.ZERO_STRING,
            status: "JOINED",
            correlationId,
            referralCode: normalizedCode,
            ip,
            deviceId: safeDeviceId,
        }));
        return {
            referralCode: normalizedCode,
            walletSnapshot: {
                cashBalance: invitedUserWallet.cashBalance.toString(),
                bonusBalance: invitedUserWallet.bonusBalance.toString(),
                airtimeBalance: numbers_1.ZERO_STRING,
            },
            inviter: {
                id: updatedInviter.id,
                referralCount: updatedInviter.referralCount,
                bonusBalance: (updatedInviter.wallet?.bonusBalance ?? new client_1.Prisma.Decimal(numbers_1.ZERO)).toString(),
            },
            invitedUser: {
                id: updatedInvitedUser.id,
                referredById: updatedInvitedUser.referredById,
                referralStatus: updatedInvitedUser.referralStatus,
                referralJoinedAt: updatedInvitedUser.referralJoinedAt,
                referralActivatedAt: updatedInvitedUser.referralActivatedAt,
            },
            usage: {
                applied: true,
                suspicious: !allowed,
            },
        };
    });
}
async function activateReferralFromJoinedToActive({ referredUserId, sourceAction = "open_box_success", endpoint = "game/open-box", tx, }) {
    const runActivation = async (client) => {
        const referredUser = await client.user.findUnique({
            where: { id: referredUserId },
            select: {
                referredById: true,
                referralStatus: true,
            },
        });
        if (!referredUser?.referredById) {
            return null;
        }
        if (referredUser.referralStatus !== "JOINED") {
            return null;
        }
        const referrerId = referredUser.referredById;
        const correlationId = (0, requestContext_service_1.getCorrelationId)() ?? "unknown";
        const config = await (0, gameConfig_service_1.getValidatedGameConfig)({ bypassCache: true });
        const rewardAmount = config.referralRewardAmount;
        await (0, logger_1.logStructuredEvent)("referral_activation_attempt", (0, referralLogPayload_service_1.createReferralStructuredLogPayload)({
            event: "referral_activation_attempt",
            endpoint,
            inviterId: referrerId,
            referredUserId,
            rewardAmount: rewardAmount.toString(),
            status: "JOINED",
            correlationId,
            referralCode: null,
        }));
        let rewardGrant;
        try {
            rewardGrant = await client.referralRewardGrant.create({
                data: {
                    inviterId: referrerId,
                    referredUserId,
                    amount: rewardAmount,
                    sourceAction,
                },
                select: { id: true, amount: true },
            });
        }
        catch (error) {
            if (!(error instanceof client_1.Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
                throw error;
            }
            const findReferralTx = typeof client.transaction.findFirst === "function"
                ? client.transaction.findFirst({
                    where: {
                        userId: referrerId,
                        type: "REFERRAL",
                        meta: {
                            path: ["referredUserId"],
                            equals: referredUserId,
                        },
                    },
                    orderBy: { createdAt: "desc" },
                    select: { id: true },
                })
                : Promise.resolve(null);
            const [existingGrant, existingReferralTx] = await Promise.all([
                client.referralRewardGrant.findUnique({
                    where: { referredUserId },
                    select: { id: true, amount: true },
                }),
                findReferralTx,
            ]);
            await (0, logger_1.logStructuredEvent)("referral_duplicate_blocked", (0, referralLogPayload_service_1.createReferralStructuredLogPayload)({
                event: "referral_duplicate_blocked",
                endpoint,
                inviterId: referrerId,
                referredUserId,
                rewardAmount: existingGrant?.amount?.toString?.() ?? rewardAmount.toString(),
                status: "JOINED",
                referralId: existingGrant?.id ?? null,
                transactionId: existingReferralTx?.id ?? null,
                reason: "reward_grant_unique_conflict",
                detectionSource: "p2002",
                correlationId,
            }));
            // A concurrent request already granted the reward. Returning null keeps this path idempotent.
            return null;
        }
        const activationUpdate = await client.user.updateMany({
            where: {
                id: referredUserId,
                referralStatus: "JOINED",
            },
            data: {
                referralStatus: "ACTIVE",
                referralActivatedAt: new Date(),
            },
        });
        if (activationUpdate.count !== numbers_1.ONE) {
            throw new Error("Referral status transition failed: expected JOINED -> ACTIVE");
        }
        const referrerWalletBefore = await client.wallet.findUnique({
            where: { userId: referrerId },
            select: {
                cashBalance: true,
                bonusBalance: true,
            },
        });
        if (!referrerWalletBefore) {
            throw new Error("Referrer wallet not found");
        }
        const balanceBefore = referrerWalletBefore.cashBalance.plus(referrerWalletBefore.bonusBalance);
        const referrerWalletAfter = await client.wallet.update({
            where: { userId: referrerId },
            data: {
                cashBalance: { increment: rewardAmount },
            },
            select: {
                cashBalance: true,
                bonusBalance: true,
            },
        });
        const balanceAfter = referrerWalletAfter.cashBalance.plus(referrerWalletAfter.bonusBalance);
        if (!balanceAfter.minus(balanceBefore).equals(rewardAmount)) {
            throw new Error("Referral wallet increment mismatch");
        }
        const referralTx = await client.transaction.create({
            data: {
                userId: referrerId,
                type: "REFERRAL",
                amount: rewardAmount,
                balanceBefore,
                balanceAfter,
                meta: {
                    referredUserId,
                    milestone: "open_box_first_success",
                },
            },
            select: { id: true },
        });
        await (0, auditLog_service_1.logAudit)({
            userId: referredUserId,
            action: "referral_reward_triggered",
            details: {
                referrerId,
                sourceAction,
                transition: "JOINED_TO_ACTIVE",
            },
            tx: client,
        });
        await (0, auditLog_service_1.logAudit)({
            userId: referrerId,
            action: "referral_reward",
            details: {
                rewardAmount: rewardAmount.toString(),
                referredUserId,
                sourceAction,
            },
            tx: client,
        });
        await (0, logger_1.logStructuredEvent)("referral_reward_granted", (0, referralLogPayload_service_1.createReferralStructuredLogPayload)({
            event: "referral_reward_granted",
            endpoint,
            inviterId: referrerId,
            referredUserId,
            rewardAmount: rewardAmount.toString(),
            status: "ACTIVE",
            referralId: rewardGrant.id,
            transactionId: referralTx.id,
            correlationId,
        }));
        return {
            referredUserId,
            referrerId,
            rewardAmount: rewardAmount.toString(),
            referralId: rewardGrant.id,
            transactionId: referralTx.id,
        };
    };
    if (tx) {
        return runActivation(tx);
    }
    return db_1.prisma.$transaction(async (transactionClient) => runActivation(transactionClient));
}
