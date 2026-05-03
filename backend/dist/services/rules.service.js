"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canUserPlay = canUserPlay;
exports.canActivateReferral = canActivateReferral;
exports.isCooldownActive = isCooldownActive;
exports.canUserWithdraw = canUserWithdraw;
exports.canUseReferral = canUseReferral;
exports.canUnlockWaitlistBonus = canUnlockWaitlistBonus;
exports.isRapidOnboardingCompletion = isRapidOnboardingCompletion;
exports.shouldEvaluateReferralOnPlay = shouldEvaluateReferralOnPlay;
const db_1 = require("../config/db");
const redis_1 = require("../config/redis");
const gameConfig_service_1 = require("./gameConfig.service");
const DAY_WINDOW_SECONDS = 24 * 60 * 60;
const MAX_REFERRAL_ATTEMPTS_PER_USER_PER_DAY = 10;
function resolveClient(client) {
    return client ?? db_1.prisma;
}
function evaluateCanUserPlayWithThreshold(user, riskThreshold) {
    return !user.isFrozen && user.accountStatus === "ACTIVE" && user.riskScore <= riskThreshold;
}
async function canUserPlay({ user, }) {
    const config = await (0, gameConfig_service_1.getValidatedGameConfig)({ bypassCache: true });
    return evaluateCanUserPlayWithThreshold(user, config.withdrawRiskThreshold);
}
function canActivateReferral(referral) {
    return referral.status === "JOINED";
}
async function isCooldownActive({ since, kind, }) {
    const config = await (0, gameConfig_service_1.getValidatedGameConfig)({ bypassCache: true });
    const cooldownMs = kind === "withdraw_after_reward" ? config.withdrawCooldownMs : config.minPlayIntervalMs;
    if (!since) {
        return { active: false, elapsedMs: Number.MAX_SAFE_INTEGER, cooldownMs };
    }
    const elapsedMs = Date.now() - since.getTime();
    return { active: elapsedMs < cooldownMs, elapsedMs, cooldownMs };
}
async function canUserWithdraw({ user, lastRewardAt, }) {
    const config = await (0, gameConfig_service_1.getValidatedGameConfig)({ bypassCache: true });
    if (user.isFrozen || user.accountStatus === "FROZEN") {
        return { allowed: false, reason: "frozen_account_withdraw_attempt" };
    }
    if (!evaluateCanUserPlayWithThreshold(user, config.withdrawRiskThreshold)) {
        return { allowed: false, reason: "high_risk_withdraw_attempt" };
    }
    if (user.totalPlaysCount < config.withdrawMinPlays) {
        return {
            allowed: false,
            reason: "minimum_play_requirement_not_met",
            requiredMinPlays: config.withdrawMinPlays,
        };
    }
    const cooldown = await isCooldownActive({
        since: lastRewardAt,
        kind: "withdraw_after_reward",
    });
    if (cooldown.active) {
        return {
            allowed: false,
            reason: "reward_cooldown",
            cooldownMs: cooldown.cooldownMs,
            elapsedMs: cooldown.elapsedMs,
        };
    }
    return { allowed: true };
}
async function canUseReferral({ ip, deviceId, referrerId, referredId, client, }) {
    const resolvedClient = resolveClient(client);
    const config = await (0, gameConfig_service_1.getValidatedGameConfig)({ bypassCache: true });
    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dayBucket = dayStart.toISOString().slice(0, 10);
    if (referredId) {
        await resolvedClient.user.updateMany({
            where: { id: referredId },
            data: {
                referralAttempts: { increment: 1 },
                lastReferralAt: now,
            },
        });
    }
    const safeIp = ip?.trim() || "unknown";
    const safeDeviceId = deviceId?.trim() || undefined;
    let countByIp;
    try {
        const ipKey = `referral:ip:${dayBucket}:${safeIp}`;
        countByIp = await redis_1.redis.incr(ipKey);
        if (countByIp === 1) {
            await redis_1.redis.expire(ipKey, DAY_WINDOW_SECONDS);
        }
    }
    catch {
        countByIp = await resolvedClient.referralLog.count({
            where: {
                ip: safeIp,
                createdAt: { gte: dayStart },
            },
        });
    }
    if (countByIp >= config.maxReferralsPerIpPerDay) {
        return false;
    }
    if (referredId) {
        try {
            const userAttemptKey = `referral:attempt:user:${dayBucket}:${referredId}`;
            const userAttemptsToday = await redis_1.redis.incr(userAttemptKey);
            if (userAttemptsToday === 1) {
                await redis_1.redis.expire(userAttemptKey, DAY_WINDOW_SECONDS);
            }
            if (userAttemptsToday > MAX_REFERRAL_ATTEMPTS_PER_USER_PER_DAY) {
                return false;
            }
        }
        catch {
            // Redis outage should not break request flow; DB checks still enforce IP/device constraints.
        }
    }
    if (referrerId && referredId) {
        const [referrer, referred] = await Promise.all([
            resolvedClient.user.findUnique({ where: { id: referrerId }, select: { deviceHash: true, createdIp: true } }),
            resolvedClient.user.findUnique({ where: { id: referredId }, select: { deviceHash: true, createdIp: true } }),
        ]);
        if (!referrer || !referred)
            return false;
        if (referrer.createdIp === referred.createdIp)
            return false;
        if (referrer.deviceHash && referred.deviceHash && referrer.deviceHash === referred.deviceHash) {
            return false;
        }
    }
    if (safeDeviceId) {
        let countByDevice;
        try {
            const deviceKey = `referral:device:${dayBucket}:${safeDeviceId}`;
            countByDevice = await redis_1.redis.incr(deviceKey);
            if (countByDevice === 1) {
                await redis_1.redis.expire(deviceKey, DAY_WINDOW_SECONDS);
            }
        }
        catch {
            countByDevice = await resolvedClient.referralLog.count({
                where: {
                    deviceId: safeDeviceId,
                    createdAt: { gte: dayStart },
                },
            });
        }
        if (countByDevice >= config.maxReferralsPerIpPerDay) {
            return false;
        }
    }
    return true;
}
async function canUnlockWaitlistBonus({ user, }) {
    const config = await (0, gameConfig_service_1.getValidatedGameConfig)({ bypassCache: true });
    const canUnlockBonus = user.waitlistBonusEligible &&
        user.accountStatus === "ACTIVE" &&
        user.riskScore <= config.waitlistRiskThreshold;
    return user.totalPlaysCount >= config.maxPlaysPerDay && !user.waitlistBonusUnlocked && canUnlockBonus;
}
async function isRapidOnboardingCompletion(playTimestampsMs) {
    const config = await (0, gameConfig_service_1.getValidatedGameConfig)({ bypassCache: true });
    if (playTimestampsMs.length < config.maxPlaysPerDay) {
        return false;
    }
    const newest = playTimestampsMs[0];
    const oldest = playTimestampsMs[playTimestampsMs.length - 1];
    return newest - oldest <= config.rapidOnboardingWindowMs;
}
function shouldEvaluateReferralOnPlay(totalPlaysBefore, referredById) {
    return totalPlaysBefore === 0 && !!referredById;
}
