"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openBox = openBox;
exports.openFreeBox = openFreeBox;
exports.getBoxes = getBoxes;
const db_1 = require("../../config/db");
const client_1 = require("@prisma/client");
const withTransactionRetry_1 = require("../../services/withTransactionRetry");
const reward_service_1 = require("../../services/reward.service");
const lock_1 = require("../../utils/lock");
const suspiciousActionLog_service_1 = require("../../services/suspiciousActionLog.service");
const auditLog_service_1 = require("../../services/auditLog.service");
const logger_1 = require("../../services/logger");
const fraudDetection_service_1 = require("../../services/fraudDetection.service");
const idempotency_service_1 = require("../../services/idempotency.service");
const bonus_service_1 = require("../../services/bonus.service");
const referral_service_1 = require("../../services/referral.service");
const crypto_1 = __importDefault(require("crypto"));
const rtp_service_1 = require("../../services/rtp.service");
const WAITLIST_BONUS_AMOUNT = new client_1.Prisma.Decimal(1000);
const WAITLIST_UNLOCK_PLAYS = 5;
const REFERRAL_REWARD_AMOUNT = new client_1.Prisma.Decimal(200);
const FIRST_PLAY_REWARD_MIN = 150;
const FIRST_PLAY_REWARD_MAX = 251;
const RAPID_ONBOARDING_WINDOW_MS = 10 * 1000;
const MIN_PLAY_INTERVAL_MS = 300;
const RESTRICTED_RISK_THRESHOLD = 70;
function ensureUserNotFrozen(user) {
    if (user.isFrozen) {
        throw new Error("Account is frozen");
    }
}
function assertFirstPlayRewardRange(reward) {
    const value = reward.toNumber();
    if (value < FIRST_PLAY_REWARD_MIN || value > FIRST_PLAY_REWARD_MAX - 1) {
        throw new Error("CRITICAL: First play reward violation");
    }
}
function logFirstPlayReward(userId, action, reward) {
    console.info("[FirstPlayReward]", {
        userId,
        action,
        reward: reward.toString(),
        min: FIRST_PLAY_REWARD_MIN,
        max: FIRST_PLAY_REWARD_MAX - 1,
    });
}
function applyOnboardingRtpControl(reward, boxPrice, onboardingRtpModifier) {
    const factor = new client_1.Prisma.Decimal(onboardingRtpModifier);
    const maxSafeReward = boxPrice.mul(new client_1.Prisma.Decimal(1.2));
    const adjusted = reward.mul(factor);
    return adjusted.gt(maxSafeReward) ? maxSafeReward : adjusted;
}
async function unlockWaitlistBonusIfEligible(tx, userId) {
    const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
            totalPlaysCount: true,
            waitlistBonusUnlocked: true,
            waitlistBonusEligible: true,
            accountStatus: true,
            riskScore: true,
        },
    });
    if (!user)
        return;
    const canUnlockBonus = user.waitlistBonusEligible && user.accountStatus === "ACTIVE" && user.riskScore <= 50;
    if (user.totalPlaysCount >= WAITLIST_UNLOCK_PLAYS && !user.waitlistBonusUnlocked && canUnlockBonus) {
        await tx.user.update({
            where: { id: userId },
            data: {
                waitlistBonusUnlocked: true,
                welcomeBonusUnlocked: true,
            },
        });
        await tx.wallet.update({
            where: { userId },
            data: { bonusLocked: false },
        });
    }
}
async function detectRapidOnboardingCompletion(tx, userId) {
    const lastFivePlayTransactions = await tx.transaction.findMany({
        where: {
            userId,
            type: { in: ["BOX_PURCHASE", "FREE_BOX"] },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { createdAt: true },
    });
    if (lastFivePlayTransactions.length < 5)
        return;
    const newest = lastFivePlayTransactions[0].createdAt.getTime();
    const oldest = lastFivePlayTransactions[lastFivePlayTransactions.length - 1].createdAt.getTime();
    if (newest - oldest <= RAPID_ONBOARDING_WINDOW_MS) {
        await tx.user.update({
            where: { id: userId },
            data: {
                waitlistBonusEligible: false,
            },
        });
        await tx.wallet.update({
            where: { userId },
            data: { bonusLocked: true },
        });
        await (0, suspiciousActionLog_service_1.logSuspiciousAction)({
            userId,
            type: "onboarding_abuse",
            metadata: { playCount: 5, durationMs: newest - oldest },
            tx,
        });
    }
}
async function enforceGameplayPacing(tx, user, action) {
    if (!user.lastPlayTimestamp)
        return;
    const elapsedMs = Date.now() - user.lastPlayTimestamp.getTime();
    if (elapsedMs < MIN_PLAY_INTERVAL_MS) {
        await (0, suspiciousActionLog_service_1.logSuspiciousAction)({
            userId: user.id,
            type: "rapid_play",
            metadata: { action, elapsedMs, minIntervalMs: MIN_PLAY_INTERVAL_MS },
            tx,
        });
    }
}
async function openBox(userId, boxId, idempotencyKey, ip, deviceId) {
    return (0, lock_1.withUserLock)(userId, async () => {
        return (0, withTransactionRetry_1.withTransactionRetry)(db_1.prisma, async (tx) => {
            await (0, logger_1.logStructuredEvent)("financial_operation", {
                userId,
                action: "open_box_attempt",
                reward: null,
                idempotencyKey,
                timestamp: new Date().toISOString(),
            });
            const existing = await (0, idempotency_service_1.checkIdempotencyKey)({ id: idempotencyKey, userId, tx });
            if (existing?.status === "COMPLETED") {
                await (0, logger_1.logStructuredEvent)("financial_operation", {
                    userId,
                    action: "idempotency_replay",
                    reward: existing.response?.data?.reward ?? null,
                    idempotencyKey,
                    timestamp: new Date().toISOString(),
                });
                return existing.response;
            }
            if (existing?.status === "PENDING") {
                throw new Error("Idempotent request is still processing");
            }
            try {
                await (0, idempotency_service_1.createIdempotencyKey)({ id: idempotencyKey, userId, action: "openBox", tx });
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
                    id: true,
                    platformId: true,
                    isFrozen: true,
                    accountStatus: true,
                    riskScore: true,
                    totalPlaysCount: true,
                    referredById: true,
                    lastPlayTimestamp: true,
                },
            });
            if (!user)
                throw new Error("User not found");
            ensureUserNotFrozen(user);
            if (user.accountStatus !== "ACTIVE" || user.riskScore > RESTRICTED_RISK_THRESHOLD) {
                throw new Error("Account restricted");
            }
            await enforceGameplayPacing(tx, { id: user.id, lastPlayTimestamp: user.lastPlayTimestamp }, "openBox");
            const isOnboarding = user.totalPlaysCount < WAITLIST_UNLOCK_PLAYS;
            await tx.boxOpenLog.create({
                data: { userId, ip: ip || "", deviceId, action: "openBox" },
            });
            const box = await tx.box.findUnique({ where: { id: boxId } });
            if (!box)
                throw new Error("Box not found");
            const wallet = await tx.wallet.findUnique({ where: { userId } });
            if (!wallet)
                throw new Error("Wallet not found");
            const availableBonus = wallet.bonusLocked ? new client_1.Prisma.Decimal(0) : wallet.bonusBalance;
            const spendableTotal = wallet.cashBalance.plus(availableBonus);
            const totalBeforePurchase = wallet.cashBalance.plus(wallet.bonusBalance);
            if (spendableTotal.lt(box.price)) {
                throw new Error("Insufficient balance");
            }
            let cashUsed = new client_1.Prisma.Decimal(0);
            let bonusUsed = new client_1.Prisma.Decimal(0);
            if (availableBonus.gte(box.price)) {
                bonusUsed = box.price;
            }
            else if (wallet.cashBalance.gte(box.price)) {
                cashUsed = box.price;
            }
            else {
                bonusUsed = availableBonus;
                cashUsed = box.price.minus(bonusUsed);
            }
            const nextCashBalance = wallet.cashBalance.minus(cashUsed);
            const nextBonusBalance = wallet.bonusBalance.minus(bonusUsed);
            await (0, logger_1.logStructuredEvent)("financial_operation", {
                userId,
                action: "box_purchase_mutation_before",
                amount: box.price.toString(),
                idempotencyKey,
                timestamp: new Date().toISOString(),
            });
            const deductResult = await tx.wallet.updateMany({
                where: {
                    userId,
                    cashBalance: wallet.cashBalance,
                    bonusBalance: wallet.bonusBalance,
                },
                data: {
                    cashBalance: nextCashBalance,
                    bonusBalance: nextBonusBalance,
                },
            });
            await (0, logger_1.logStructuredEvent)("financial_operation", {
                userId,
                action: "box_purchase_mutation_after",
                amount: box.price.toString(),
                idempotencyKey,
                timestamp: new Date().toISOString(),
            });
            if (deductResult.count === 0) {
                throw new Error("Balance changed, please retry");
            }
            const walletAfterDeduct = await tx.wallet.findUnique({ where: { userId } });
            if (!walletAfterDeduct)
                throw new Error("Wallet not found");
            await tx.transaction.create({
                data: {
                    userId,
                    boxId,
                    type: "BOX_PURCHASE",
                    amount: box.price.neg(),
                    balanceBefore: totalBeforePurchase,
                    balanceAfter: walletAfterDeduct.cashBalance.plus(walletAfterDeduct.bonusBalance),
                    meta: { cashUsed: cashUsed.toString(), bonusUsed: bonusUsed.toString(), bonusLocked: wallet.bonusLocked },
                },
            });
            const isFirstPlay = user.totalPlaysCount === 0;
            let reward;
            if (isFirstPlay) {
                reward = new client_1.Prisma.Decimal(crypto_1.default.randomInt(150, 251));
                assertFirstPlayRewardRange(reward);
                logFirstPlayReward(userId, "openBox", reward);
            }
            else {
                const rewardObj = await (0, reward_service_1.generateRewardFromDB)(boxId, tx);
                reward = rewardObj.amount;
                if (isOnboarding) {
                    const config = await tx.gameConfig.findUnique({ where: { id: "global" } });
                    const onboardingFactor = Math.max(1, Math.min(config?.rtpModifier ?? 1.1, 1.2));
                    reward = applyOnboardingRtpControl(reward, box.price, onboardingFactor);
                }
                else {
                    await (0, rtp_service_1.adjustRewardProbabilities)(false);
                }
            }
            await (0, logger_1.logStructuredEvent)("financial_operation", {
                userId,
                action: "box_reward_mutation_before",
                reward: reward.toString(),
                idempotencyKey,
                timestamp: new Date().toISOString(),
            });
            const openBoxSuspicion = (0, fraudDetection_service_1.recordBoxOpenAttempt)(userId);
            if (openBoxSuspicion.isSuspicious) {
                await (0, logger_1.logStructuredEvent)("fraud_detected", {
                    userId,
                    reason: openBoxSuspicion.reason,
                    type: "open_box_rate",
                    timestamp: new Date().toISOString(),
                });
            }
            const rewardSuspicion = (0, fraudDetection_service_1.recordRewardEvent)(userId, reward);
            if (rewardSuspicion.isSuspicious) {
                await (0, logger_1.logStructuredEvent)("fraud_detected", {
                    userId,
                    reason: rewardSuspicion.reason,
                    type: "reward_spike",
                    amount: reward.toString(),
                    timestamp: new Date().toISOString(),
                });
            }
            await tx.wallet.update({
                where: { userId },
                data: { cashBalance: { increment: reward } },
            });
            await (0, logger_1.logStructuredEvent)("financial_operation", {
                userId,
                action: "box_reward_mutation_after",
                reward: reward.toString(),
                idempotencyKey,
                timestamp: new Date().toISOString(),
            });
            if (bonusUsed.gt(0)) {
                await (0, bonus_service_1.trackBonusUsage)({ userId, bonusType: "box", amount: bonusUsed, tx });
            }
            const walletAfterReward = await tx.wallet.findUnique({ where: { userId } });
            if (!walletAfterReward)
                throw new Error("Wallet not found");
            await tx.transaction.create({
                data: {
                    userId,
                    boxId,
                    type: "BOX_REWARD",
                    amount: reward,
                    balanceBefore: walletAfterDeduct.cashBalance.plus(walletAfterDeduct.bonusBalance),
                    balanceAfter: walletAfterReward.cashBalance.plus(walletAfterReward.bonusBalance),
                },
            });
            await tx.boxOpen.create({
                data: { userId, boxId, rewardAmount: reward },
            });
            await tx.systemStats.upsert({
                where: { id: "global" },
                update: {
                    totalIn: { increment: box.price },
                    totalOut: { increment: reward },
                    totalBoxesOpened: { increment: 1 },
                },
                create: {
                    id: "global",
                    totalIn: box.price,
                    totalOut: reward,
                    totalBoxesOpened: 1,
                    jackpotWins: 0,
                },
            });
            const playState = await tx.user.update({
                where: { id: userId },
                data: {
                    totalPlaysCount: { increment: 1 },
                    paidBoxesOpened: { increment: 1 },
                    lastPlayTimestamp: new Date(),
                },
                select: { totalPlaysCount: true, referredById: true },
            });
            await unlockWaitlistBonusIfEligible(tx, userId);
            await processReferralRewardIfEligible(tx, userId, playState.totalPlaysCount, playState.referredById);
            if (playState.totalPlaysCount >= WAITLIST_UNLOCK_PLAYS) {
                await detectRapidOnboardingCompletion(tx, userId);
            }
            // Referral anti-abuse and delayed reward.
            if (user.totalPlaysCount === 0 && playState.referredById) {
                const referrer = await tx.user.findUnique({ where: { id: playState.referredById } });
                if (referrer && referrer.platformId === user.platformId) {
                    await (0, referral_service_1.logReferral)({ referrerId: playState.referredById, referredId: userId, ip: ip || "", deviceId, suspicious: true, tx });
                    await (0, suspiciousActionLog_service_1.logSuspiciousAction)({ userId, type: "referral_fraud", metadata: { referrerId: playState.referredById }, tx });
                }
                else {
                    const allowed = await (0, referral_service_1.checkReferralLimits)({
                        ip: ip || "",
                        deviceId,
                        referrerId: playState.referredById,
                        referredId: userId,
                        tx,
                    });
                    await (0, referral_service_1.logReferral)({ referrerId: playState.referredById, referredId: userId, ip: ip || "", deviceId, suspicious: !allowed, tx });
                    if (!allowed) {
                        await (0, suspiciousActionLog_service_1.logSuspiciousAction)({ userId, type: "referral_fraud", metadata: { referrerId: playState.referredById }, tx });
                    }
                }
            }
            const completedResponse = await (0, idempotency_service_1.completeIdempotencyKey)({
                id: idempotencyKey,
                userId,
                response: {
                    reward: reward.toString(),
                },
                metadata: {
                    boxId,
                    action: "openBox",
                    walletSnapshot: {
                        cashBalance: walletAfterReward.cashBalance,
                        bonusBalance: walletAfterReward.bonusBalance,
                    },
                },
                tx,
            });
            await (0, auditLog_service_1.logAudit)({ userId, action: "box_open", details: { boxId, reward: reward.toString() }, tx });
            await (0, logger_1.logStructuredEvent)("financial_operation", {
                userId,
                action: "box_opened",
                amount: box.price.toString(),
                reward: reward.toString(),
                idempotencyKey,
                timestamp: new Date().toISOString(),
            });
            return completedResponse;
        });
    }).catch(async (err) => {
        await (0, logger_1.logStructuredEvent)("financial_operation", {
            userId,
            action: "box_open_failed",
            reward: null,
            idempotencyKey,
            timestamp: new Date().toISOString(),
            message: err instanceof Error ? err.message : String(err),
        });
        throw err;
    });
}
async function openFreeBox(userId, idempotencyKey, ip, deviceId) {
    return (0, lock_1.withUserLock)(userId, async () => {
        return (0, withTransactionRetry_1.withTransactionRetry)(db_1.prisma, async (tx) => {
            await (0, logger_1.logStructuredEvent)("financial_operation", {
                userId,
                action: "open_free_box_attempt",
                reward: null,
                idempotencyKey,
                timestamp: new Date().toISOString(),
            });
            const existing = await (0, idempotency_service_1.checkIdempotencyKey)({ id: idempotencyKey, userId, tx });
            if (existing?.status === "COMPLETED") {
                await (0, logger_1.logStructuredEvent)("financial_operation", {
                    userId,
                    action: "idempotency_replay",
                    reward: existing.response?.data?.reward ?? null,
                    idempotencyKey,
                    timestamp: new Date().toISOString(),
                });
                return existing.response;
            }
            if (existing?.status === "PENDING") {
                throw new Error("Idempotent request is still processing");
            }
            try {
                await (0, idempotency_service_1.createIdempotencyKey)({ id: idempotencyKey, userId, action: "openFreeBox", tx });
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
                    id: true,
                    isFrozen: true,
                    accountStatus: true,
                    riskScore: true,
                    freeBoxUsed: true,
                    totalPlaysCount: true,
                    referredById: true,
                    waitlistBonusUnlocked: true,
                    lastPlayTimestamp: true,
                },
            });
            if (!user)
                throw new Error("User not found");
            ensureUserNotFrozen(user);
            if (user.accountStatus !== "ACTIVE" || user.riskScore > RESTRICTED_RISK_THRESHOLD) {
                throw new Error("Account restricted");
            }
            await enforceGameplayPacing(tx, { id: user.id, lastPlayTimestamp: user.lastPlayTimestamp }, "openFreeBox");
            const markUsed = await tx.user.updateMany({
                where: { id: userId, freeBoxUsed: false },
                data: { freeBoxUsed: true },
            });
            if (markUsed.count === 0) {
                throw new Error("Free box already used");
            }
            await tx.boxOpenLog.create({
                data: { userId, ip: ip || "", deviceId, action: "freeBox" },
            });
            const wallet = await tx.wallet.findUnique({ where: { userId } });
            if (!wallet)
                throw new Error("Wallet not found");
            const isFirstPlay = user.totalPlaysCount === 0;
            let reward = new client_1.Prisma.Decimal(0);
            if (isFirstPlay) {
                reward = new client_1.Prisma.Decimal(crypto_1.default.randomInt(150, 251));
                assertFirstPlayRewardRange(reward);
                logFirstPlayReward(userId, "openFreeBox", reward);
            }
            const openBoxSuspicion = (0, fraudDetection_service_1.recordBoxOpenAttempt)(userId);
            if (openBoxSuspicion.isSuspicious) {
                await (0, logger_1.logStructuredEvent)("fraud_detected", {
                    userId,
                    reason: openBoxSuspicion.reason,
                    type: "open_box_rate",
                    timestamp: new Date().toISOString(),
                });
            }
            const rewardSuspicion = (0, fraudDetection_service_1.recordRewardEvent)(userId, reward);
            if (rewardSuspicion.isSuspicious) {
                await (0, logger_1.logStructuredEvent)("fraud_detected", {
                    userId,
                    reason: rewardSuspicion.reason,
                    type: "reward_spike",
                    amount: reward.toString(),
                    timestamp: new Date().toISOString(),
                });
            }
            await (0, logger_1.logStructuredEvent)("financial_operation", {
                userId,
                action: "free_box_reward_mutation_before",
                reward: reward.toString(),
                idempotencyKey,
                timestamp: new Date().toISOString(),
            });
            const walletAfterReward = await tx.wallet.update({
                where: { userId },
                data: { cashBalance: { increment: reward } },
            });
            await (0, logger_1.logStructuredEvent)("financial_operation", {
                userId,
                action: "free_box_reward_mutation_after",
                reward: reward.toString(),
                idempotencyKey,
                timestamp: new Date().toISOString(),
            });
            await tx.transaction.create({
                data: {
                    userId,
                    type: "FREE_BOX",
                    amount: reward,
                    balanceBefore: wallet.cashBalance.plus(wallet.bonusBalance),
                    balanceAfter: walletAfterReward.cashBalance.plus(walletAfterReward.bonusBalance),
                    meta: {
                        firstPlayOverride: isFirstPlay,
                        reward: reward.toString(),
                        rewardRange: `${FIRST_PLAY_REWARD_MIN}-${FIRST_PLAY_REWARD_MAX - 1}`,
                    },
                },
            });
            const progress = await tx.user.update({
                where: { id: userId },
                data: { totalPlaysCount: { increment: 1 }, lastPlayTimestamp: new Date() },
                select: { totalPlaysCount: true, waitlistBonusUnlocked: true },
            });
            await unlockWaitlistBonusIfEligible(tx, userId);
            await processReferralRewardIfEligible(tx, userId, progress.totalPlaysCount, user.referredById);
            if (progress.totalPlaysCount >= WAITLIST_UNLOCK_PLAYS) {
                await detectRapidOnboardingCompletion(tx, userId);
            }
            const completedResponse = await (0, idempotency_service_1.completeIdempotencyKey)({
                id: idempotencyKey,
                userId,
                response: {
                    reward: reward.toString(),
                    totalPlaysCount: progress.totalPlaysCount,
                    waitlistBonusUnlocked: progress.waitlistBonusUnlocked || progress.totalPlaysCount >= WAITLIST_UNLOCK_PLAYS,
                    waitlistBonusAmount: WAITLIST_BONUS_AMOUNT.toString(),
                    playsRequiredToUnlock: WAITLIST_UNLOCK_PLAYS,
                    walletSnapshot: {
                        cashBalance: walletAfterReward.cashBalance,
                        bonusBalance: walletAfterReward.bonusBalance,
                    },
                },
                metadata: {
                    action: "openFreeBox",
                    totalPlaysCount: progress.totalPlaysCount,
                    waitlistBonusUnlocked: progress.waitlistBonusUnlocked || progress.totalPlaysCount >= WAITLIST_UNLOCK_PLAYS,
                    waitlistBonusAmount: WAITLIST_BONUS_AMOUNT,
                    playsRequiredToUnlock: WAITLIST_UNLOCK_PLAYS,
                    walletSnapshot: {
                        cashBalance: walletAfterReward.cashBalance,
                        bonusBalance: walletAfterReward.bonusBalance,
                    },
                },
                tx,
            });
            await (0, logger_1.logStructuredEvent)("financial_operation", {
                userId,
                action: "box_opened",
                reward: reward.toString(),
                idempotencyKey,
                timestamp: new Date().toISOString(),
            });
            return completedResponse;
        });
    }).catch(async (err) => {
        await (0, logger_1.logStructuredEvent)("financial_operation", {
            userId,
            action: "box_open_failed",
            reward: null,
            idempotencyKey,
            timestamp: new Date().toISOString(),
            message: err instanceof Error ? err.message : String(err),
        });
        throw err;
    });
}
async function getBoxes() {
    const boxes = await db_1.prisma.box.findMany({
        orderBy: { price: "asc" },
        select: {
            id: true,
            name: true,
            price: true,
        },
    });
    return boxes.map((box) => ({
        id: box.id,
        name: box.name,
        price: box.price,
    }));
}
async function processReferralRewardIfEligible(tx, userId, playCount, referredById) {
    if (!referredById || playCount < WAITLIST_UNLOCK_PLAYS)
        return;
    const referredUser = await tx.user.findUnique({
        where: { id: userId },
        select: {
            referralRewardPending: true,
            createdIp: true,
            deviceHash: true,
        },
    });
    if (!referredUser || !referredUser.referralRewardPending)
        return;
    const referrer = await tx.user.findUnique({
        where: { id: referredById },
        select: {
            id: true,
            createdIp: true,
            deviceHash: true,
            accountStatus: true,
            wallet: {
                select: { cashBalance: true, bonusBalance: true },
            },
        },
    });
    if (!referrer || !referrer.wallet || referrer.accountStatus !== "ACTIVE") {
        await tx.user.update({
            where: { id: userId },
            data: { referralRewardPending: false, referralActivityMet: true },
        });
        return;
    }
    const sameIp = referrer.createdIp === referredUser.createdIp;
    const sameDevice = !!referrer.deviceHash && !!referredUser.deviceHash && referrer.deviceHash === referredUser.deviceHash;
    if (sameIp || sameDevice) {
        await (0, suspiciousActionLog_service_1.logSuspiciousAction)({
            userId,
            type: "referral_fraud",
            metadata: { reason: "same_ip_or_device", referrerId: referredById },
            tx,
        });
        await tx.user.update({
            where: { id: userId },
            data: { referralRewardPending: false, referralActivityMet: true },
        });
        return;
    }
    const before = referrer.wallet.cashBalance.plus(referrer.wallet.bonusBalance);
    await tx.wallet.update({
        where: { userId: referredById },
        data: { cashBalance: { increment: REFERRAL_REWARD_AMOUNT } },
    });
    const referrerWalletAfter = await tx.wallet.findUnique({ where: { userId: referredById } });
    if (!referrerWalletAfter) {
        throw new Error("Referrer wallet not found");
    }
    await tx.transaction.create({
        data: {
            userId: referredById,
            type: "REFERRAL",
            amount: REFERRAL_REWARD_AMOUNT,
            balanceBefore: before,
            balanceAfter: referrerWalletAfter.cashBalance.plus(referrerWalletAfter.bonusBalance),
            meta: { referredUserId: userId, milestone: WAITLIST_UNLOCK_PLAYS },
        },
    });
    await tx.user.update({
        where: { id: referredById },
        data: { referralCount: { increment: 1 } },
    });
    await tx.user.update({
        where: { id: userId },
        data: { referralRewardPending: false, referralActivityMet: true },
    });
}
