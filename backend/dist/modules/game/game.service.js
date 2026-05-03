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
const lock_1 = require("../../utils/lock");
const suspiciousActionLog_service_1 = require("../../services/suspiciousActionLog.service");
const auditLog_service_1 = require("../../services/auditLog.service");
const logger_1 = require("../../services/logger");
const fraudDetection_service_1 = require("../../services/fraudDetection.service");
const idempotency_service_1 = require("../../services/idempotency.service");
const bonus_service_1 = require("../../services/bonus.service");
const referral_service_1 = require("../../services/referral.service");
const rtp_service_1 = require("../../services/rtp.service");
const gameConfig_service_1 = require("../../services/gameConfig.service");
const rules_service_1 = require("../../services/rules.service");
const reward_service_1 = require("../../services/reward.service");
const numbers_1 = require("../../constants/numbers");
const retryPrisma_1 = require("../../services/retryPrisma");
const p_limit_1 = __importDefault(require("p-limit"));
const OPEN_BOX_QUEUE_CONCURRENCY = Math.min(20, Math.max(10, Number(process.env.OPEN_BOX_QUEUE_CONCURRENCY ?? "15")));
const openBoxQueue = (0, p_limit_1.default)(OPEN_BOX_QUEUE_CONCURRENCY);
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
    const shouldUnlock = await (0, rules_service_1.canUnlockWaitlistBonus)({
        user: {
            totalPlaysCount: user.totalPlaysCount,
            waitlistBonusUnlocked: user.waitlistBonusUnlocked,
            waitlistBonusEligible: user.waitlistBonusEligible,
            accountStatus: user.accountStatus,
            riskScore: user.riskScore,
        },
    });
    if (shouldUnlock) {
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
    const config = await getGameConfig(tx);
    const lastFivePlayTransactions = await tx.transaction.findMany({
        where: {
            userId,
            type: { in: ["BOX_PURCHASE", "FREE_BOX"] },
        },
        orderBy: { createdAt: "desc" },
        take: config.maxPlaysPerDay,
        select: { createdAt: true },
    });
    const playTimestampsMs = lastFivePlayTransactions.map((row) => row.createdAt.getTime());
    const isRapid = await (0, rules_service_1.isRapidOnboardingCompletion)(playTimestampsMs);
    if (isRapid) {
        const newest = playTimestampsMs[numbers_1.ZERO];
        const oldest = playTimestampsMs[playTimestampsMs.length + numbers_1.NEGATIVE_ONE];
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
            metadata: { playCount: config.maxPlaysPerDay, durationMs: newest - oldest },
            tx,
        });
    }
}
async function enforceGameplayPacing(tx, user, action) {
    const cooldown = await (0, rules_service_1.isCooldownActive)({
        since: user.lastPlayTimestamp,
        kind: "play_interval",
        client: tx,
    });
    if (cooldown.active) {
        await (0, suspiciousActionLog_service_1.logSuspiciousAction)({
            userId: user.id,
            type: "rapid_play",
            metadata: { action, elapsedMs: cooldown.elapsedMs, minIntervalMs: cooldown.cooldownMs },
            tx,
        });
    }
}
async function getGameConfig(tx) {
    const config = await (0, gameConfig_service_1.getValidatedGameConfig)({ bypassCache: true });
    return {
        rtpModifier: config.rtpModifier,
        maxPayoutMultiplier: config.maxPayoutMultiplier,
        minRtpModifier: config.minRtpModifier,
        maxRtpModifier: config.maxRtpModifier,
        referralRewardAmount: config.referralRewardAmount,
        freeBoxRewardAmount: config.freeBoxRewardAmount,
        minBoxReward: config.minBoxReward,
        maxBoxReward: config.maxBoxReward,
        waitlistBonus: config.waitlistBonus,
        maxPlaysPerDay: config.maxPlaysPerDay,
        withdrawRiskThreshold: config.withdrawRiskThreshold,
        waitlistRiskThreshold: config.waitlistRiskThreshold,
        rapidOnboardingWindowMs: config.rapidOnboardingWindowMs,
        minPlayIntervalMs: config.minPlayIntervalMs,
    };
}
async function ensureWalletSnapshotInSuccessResponse(tx, userId, response) {
    const wallet = await tx.wallet.findUnique({
        where: { userId },
        select: {
            cashBalance: true,
            bonusBalance: true,
        },
    });
    if (!wallet) {
        throw new Error("Wallet not found");
    }
    const walletSnapshot = {
        cashBalance: wallet.cashBalance.toString(),
        bonusBalance: wallet.bonusBalance.toString(),
        airtimeBalance: numbers_1.ZERO.toString(),
    };
    if (response && typeof response === "object") {
        const envelope = response;
        if (envelope.success === true && envelope.data && typeof envelope.data === "object") {
            return {
                ...envelope,
                data: {
                    ...envelope.data,
                    walletSnapshot,
                },
            };
        }
        return {
            success: true,
            data: {
                ...envelope,
                walletSnapshot,
            },
            error: null,
        };
    }
    return {
        success: true,
        data: {
            value: response,
            walletSnapshot,
        },
        error: null,
    };
}
async function openBox(userId, boxId, idempotencyKey, ip, deviceId) {
    return openBoxQueue(() => runOpenBox(userId, boxId, idempotencyKey, ip, deviceId));
}
async function runOpenBox(userId, boxId, idempotencyKey, ip, deviceId) {
    return (0, retryPrisma_1.retryPrisma)(() => (0, lock_1.withUserLock)(userId, async () => {
        return (0, withTransactionRetry_1.withTransactionRetry)(db_1.prisma, async (tx) => {
            const recoverPendingOpenBox = async () => {
                const rewardTx = await tx.transaction.findFirst({
                    where: {
                        userId,
                        boxId,
                        type: "BOX_REWARD",
                        meta: {
                            equals: idempotencyKey,
                        },
                    },
                    orderBy: { createdAt: "desc" },
                    select: { amount: true },
                });
                if (!rewardTx) {
                    return null;
                }
                const walletSnapshot = await tx.wallet.findUnique({
                    where: { userId },
                    select: { cashBalance: true, bonusBalance: true },
                });
                return {
                    reward: rewardTx.amount.toString(),
                    walletSnapshot: {
                        cashBalance: walletSnapshot?.cashBalance ?? numbers_1.ZERO,
                        bonusBalance: walletSnapshot?.bonusBalance ?? numbers_1.ZERO,
                        airtimeBalance: numbers_1.ZERO,
                    },
                };
            };
            await (0, logger_1.logStructuredEvent)("financial_operation", {
                userId,
                action: "open_box_attempt",
                reward: null,
                idempotencyKey,
                timestamp: new Date().toISOString(),
            });
            const existing = await (0, idempotency_service_1.checkIdempotencyKey)({
                id: idempotencyKey,
                userId,
                tx,
                waitForCompletionMs: 1500,
                pollIntervalMs: 50,
                pendingStaleAfterMs: 250,
                recoverPending: async () => recoverPendingOpenBox(),
            });
            if (existing?.status === "COMPLETED") {
                await (0, logger_1.logStructuredEvent)("financial_operation", {
                    userId,
                    action: "idempotency_replay",
                    reward: existing.response?.data?.reward ?? null,
                    idempotencyKey,
                    timestamp: new Date().toISOString(),
                });
                return ensureWalletSnapshotInSuccessResponse(tx, userId, existing.response);
            }
            if (existing?.status === "PENDING") {
                throw new Error("Idempotent request is still processing");
            }
            try {
                await (0, idempotency_service_1.createIdempotencyKey)({ id: idempotencyKey, userId, action: "openBox", tx });
            }
            catch (err) {
                const duplicate = await (0, idempotency_service_1.checkIdempotencyKey)({
                    id: idempotencyKey,
                    userId,
                    tx,
                    waitForCompletionMs: 1500,
                    pollIntervalMs: 50,
                    pendingStaleAfterMs: 250,
                    recoverPending: async () => recoverPendingOpenBox(),
                });
                if (duplicate?.status === "COMPLETED") {
                    return ensureWalletSnapshotInSuccessResponse(tx, userId, duplicate.response);
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
                    totalPlaysCount: true,
                    referredById: true,
                    lastPlayTimestamp: true,
                },
            });
            if (!user)
                throw new Error("User not found");
            const config = await getGameConfig(tx);
            const playAllowed = await (0, rules_service_1.canUserPlay)({
                user: {
                    isFrozen: user.isFrozen,
                    accountStatus: user.accountStatus,
                    riskScore: user.riskScore,
                },
                client: tx,
            });
            if (!playAllowed) {
                throw new Error("Account restricted");
            }
            await enforceGameplayPacing(tx, { id: user.id, lastPlayTimestamp: user.lastPlayTimestamp }, "openBox");
            const isOnboarding = user.totalPlaysCount < config.maxPlaysPerDay;
            await tx.boxOpenLog.create({
                data: { userId, ip: ip || "", deviceId, action: "openBox" },
            });
            const box = await tx.box.findUnique({ where: { id: boxId } });
            if (!box)
                throw new Error("Box not found");
            const wallet = await tx.wallet.findUnique({ where: { userId } });
            if (!wallet)
                throw new Error("Wallet not found");
            const availableBonus = wallet.bonusLocked ? new client_1.Prisma.Decimal(numbers_1.ZERO) : wallet.bonusBalance;
            const spendableTotal = wallet.cashBalance.plus(availableBonus);
            const totalBeforePurchase = wallet.cashBalance.plus(wallet.bonusBalance);
            if (spendableTotal.lt(box.price)) {
                throw new Error("Insufficient balance");
            }
            let cashUsed = new client_1.Prisma.Decimal(numbers_1.ZERO);
            let bonusUsed = new client_1.Prisma.Decimal(numbers_1.ZERO);
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
            if (deductResult.count === numbers_1.ZERO) {
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
            const context = {
                kind: "open_box",
                boxPrice: box.price,
                isOnboarding,
            };
            const reward = (0, reward_service_1.generateReward)(config, context);
            if (!isOnboarding) {
                await (0, rtp_service_1.adjustRewardProbabilities)(false);
            }
            await (0, logger_1.logStructuredEvent)("financial_operation", {
                userId,
                action: "box_reward_mutation_before",
                reward: reward.toString(),
                idempotencyKey,
                timestamp: new Date().toISOString(),
            });
            const openBoxSuspicion = await (0, fraudDetection_service_1.recordBoxOpenAttempt)(userId);
            if (openBoxSuspicion.isSuspicious) {
                await (0, logger_1.logStructuredEvent)("fraud_detected", {
                    userId,
                    reason: openBoxSuspicion.reason,
                    type: "open_box_rate",
                    timestamp: new Date().toISOString(),
                });
            }
            const rewardSuspicion = await (0, fraudDetection_service_1.recordRewardEvent)(userId, reward);
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
            if (bonusUsed.gt(numbers_1.ZERO)) {
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
                    meta: idempotencyKey,
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
                    totalBoxesOpened: { increment: numbers_1.ONE },
                },
                create: {
                    id: "global",
                    totalIn: box.price,
                    totalOut: reward,
                    totalBoxesOpened: numbers_1.ONE,
                    jackpotWins: numbers_1.ZERO,
                },
            });
            const playState = await tx.user.update({
                where: { id: userId },
                data: {
                    totalPlaysCount: { increment: numbers_1.ONE },
                    paidBoxesOpened: { increment: numbers_1.ONE },
                    lastPlayTimestamp: new Date(),
                },
                select: { totalPlaysCount: true, referredById: true },
            });
            await unlockWaitlistBonusIfEligible(tx, userId);
            const referralActivation = await (0, referral_service_1.activateReferralFromJoinedToActive)({
                referredUserId: user.id,
                sourceAction: "open_box_success",
                endpoint: "game/open-box",
                tx,
            });
            await detectRapidOnboardingCompletion(tx, userId);
            // Referral anti-abuse and delayed reward.
            if ((0, rules_service_1.shouldEvaluateReferralOnPlay)(user.totalPlaysCount, playState.referredById)) {
                const referrer = await tx.user.findUnique({ where: { id: playState.referredById } });
                if (referrer && referrer.id === user.id) {
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
                    ...(referralActivation ? { referralActivation } : {}),
                    walletSnapshot: {
                        cashBalance: walletAfterReward.cashBalance,
                        bonusBalance: walletAfterReward.bonusBalance,
                        airtimeBalance: numbers_1.ZERO,
                    },
                },
                metadata: {
                    boxId,
                    action: "openBox",
                    ...(referralActivation ? { referralActivation } : {}),
                    walletSnapshot: {
                        cashBalance: walletAfterReward.cashBalance,
                        bonusBalance: walletAfterReward.bonusBalance,
                        airtimeBalance: numbers_1.ZERO,
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
            return ensureWalletSnapshotInSuccessResponse(tx, userId, completedResponse);
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
    }));
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
                return ensureWalletSnapshotInSuccessResponse(tx, userId, existing.response);
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
                    return ensureWalletSnapshotInSuccessResponse(tx, userId, duplicate.response);
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
            const config = await getGameConfig(tx);
            const playAllowed = await (0, rules_service_1.canUserPlay)({
                user: {
                    isFrozen: user.isFrozen,
                    accountStatus: user.accountStatus,
                    riskScore: user.riskScore,
                },
                client: tx,
            });
            if (!playAllowed) {
                throw new Error("Account restricted");
            }
            await enforceGameplayPacing(tx, { id: user.id, lastPlayTimestamp: user.lastPlayTimestamp }, "openFreeBox");
            const markUsed = await tx.user.updateMany({
                where: { id: userId, freeBoxUsed: false },
                data: { freeBoxUsed: true },
            });
            if (markUsed.count === numbers_1.ZERO) {
                throw new Error("Free box already used");
            }
            await tx.boxOpenLog.create({
                data: { userId, ip: ip || "", deviceId, action: "freeBox" },
            });
            const wallet = await tx.wallet.findUnique({ where: { userId } });
            if (!wallet)
                throw new Error("Wallet not found");
            const context = { kind: "free_box" };
            const reward = (0, reward_service_1.generateReward)(config, context);
            const openBoxSuspicion = await (0, fraudDetection_service_1.recordBoxOpenAttempt)(userId);
            if (openBoxSuspicion.isSuspicious) {
                await (0, logger_1.logStructuredEvent)("fraud_detected", {
                    userId,
                    reason: openBoxSuspicion.reason,
                    type: "open_box_rate",
                    timestamp: new Date().toISOString(),
                });
            }
            const rewardSuspicion = await (0, fraudDetection_service_1.recordRewardEvent)(userId, reward);
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
                        source: "game_config",
                        configuredRewardRange: `${config.minBoxReward}-${config.maxBoxReward}`,
                        reward: reward.toString(),
                    },
                },
            });
            const progress = await tx.user.update({
                where: { id: userId },
                data: { totalPlaysCount: { increment: numbers_1.ONE }, lastPlayTimestamp: new Date() },
                select: { totalPlaysCount: true, waitlistBonusUnlocked: true },
            });
            await (0, auditLog_service_1.logAudit)({
                userId,
                action: "free_box_reward",
                details: {
                    reward: reward.toString(),
                    idempotencyKey,
                    source: "game_config",
                    configuredRewardRange: `${config.minBoxReward}-${config.maxBoxReward}`,
                },
                tx,
            });
            await unlockWaitlistBonusIfEligible(tx, userId);
            await detectRapidOnboardingCompletion(tx, userId);
            const completedResponse = await (0, idempotency_service_1.completeIdempotencyKey)({
                id: idempotencyKey,
                userId,
                response: {
                    reward: reward.toString(),
                    totalPlaysCount: progress.totalPlaysCount,
                    waitlistBonusUnlocked: progress.waitlistBonusUnlocked || progress.totalPlaysCount >= config.maxPlaysPerDay,
                    waitlistBonusAmount: config.waitlistBonus.toString(),
                    playsRequiredToUnlock: config.maxPlaysPerDay,
                    walletSnapshot: {
                        cashBalance: walletAfterReward.cashBalance,
                        bonusBalance: walletAfterReward.bonusBalance,
                        airtimeBalance: numbers_1.ZERO,
                    },
                },
                metadata: {
                    action: "openFreeBox",
                    totalPlaysCount: progress.totalPlaysCount,
                    waitlistBonusUnlocked: progress.waitlistBonusUnlocked || progress.totalPlaysCount >= config.maxPlaysPerDay,
                    waitlistBonusAmount: config.waitlistBonus,
                    playsRequiredToUnlock: config.maxPlaysPerDay,
                    walletSnapshot: {
                        cashBalance: walletAfterReward.cashBalance,
                        bonusBalance: walletAfterReward.bonusBalance,
                        airtimeBalance: numbers_1.ZERO,
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
            return ensureWalletSnapshotInSuccessResponse(tx, userId, completedResponse);
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
