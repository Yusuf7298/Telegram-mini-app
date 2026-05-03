"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordBoxOpenAttempt = recordBoxOpenAttempt;
exports.recordRewardEvent = recordRewardEvent;
exports.recordWithdrawAttempt = recordWithdrawAttempt;
exports.recordReferralRewardForInviter = recordReferralRewardForInviter;
exports.recordReferralActivationForInviter = recordReferralActivationForInviter;
exports.recordReferralByIp = recordReferralByIp;
exports.recordReferralJoinedByDevice = recordReferralJoinedByDevice;
const client_1 = require("@prisma/client");
const redis_1 = require("../config/redis");
const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const OPEN_BOX_LIMIT_PER_MINUTE = 20;
const WITHDRAW_ATTEMPT_LIMIT = 3;
const WITHDRAW_SHORT_WINDOW_MS = 30 * 1000;
const REFERRAL_REWARD_BURST_WINDOW_MS = 5 * 60 * 1000;
const REFERRAL_REWARD_BURST_LIMIT = 5;
const REFERRAL_IP_WINDOW_MS = 10 * 60 * 1000;
const REFERRAL_IP_LIMIT = 8;
const REFERRAL_DEVICE_JOINED_WINDOW_MS = 10 * 60 * 1000;
const REFERRAL_DEVICE_JOINED_LIMIT = 4;
const REFERRAL_ACTIVATION_BURST_WINDOW_MS = 5 * 60 * 1000;
const REFERRAL_ACTIVATION_BURST_LIMIT = 5;
function toNumber(value) {
    if (value instanceof client_1.Prisma.Decimal) {
        return value.toNumber();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}
async function incrementWindowCounter(key, ttlSeconds) {
    const count = await redis_1.redis.incr(key);
    if (count === 1) {
        await redis_1.redis.expire(key, ttlSeconds);
    }
    return count;
}
function buildWindowKey(prefix, id, windowMs) {
    const bucket = Math.floor(Date.now() / windowMs);
    return `${prefix}:${id}:${bucket}`;
}
async function recordBoxOpenAttempt(userId) {
    try {
        const key = buildWindowKey("fraud:box_open", userId, ONE_MINUTE_MS);
        const count = await incrementWindowCounter(key, Math.ceil(ONE_MINUTE_MS / 1000) * 2);
        if (count > OPEN_BOX_LIMIT_PER_MINUTE) {
            return { isSuspicious: true, reason: "box_open_rate_high" };
        }
    }
    catch {
        return { isSuspicious: false };
    }
    return { isSuspicious: false };
}
async function recordRewardEvent(userId, rewardAmount) {
    const amount = toNumber(rewardAmount);
    try {
        const bucket = Math.floor(Date.now() / ONE_HOUR_MS);
        const countKey = `fraud:reward:count:${userId}:${bucket}`;
        const sumKey = `fraud:reward:sum:${userId}:${bucket}`;
        const [countRaw, sumRaw] = await Promise.all([redis_1.redis.get(countKey), redis_1.redis.get(sumKey)]);
        const count = Number(countRaw ?? "0");
        const sum = Number(sumRaw ?? "0");
        const avg = count > 0 ? sum / count : amount;
        const nextCount = await incrementWindowCounter(countKey, Math.ceil(ONE_HOUR_MS / 1000) * 2);
        const nextSum = await redis_1.redis.incrbyfloat(sumKey, amount);
        if (nextCount === 1 || Number(nextSum) === amount) {
            await redis_1.redis.expire(sumKey, Math.ceil(ONE_HOUR_MS / 1000) * 2);
        }
        if (count > 0 && avg > 0 && amount > avg * 5) {
            return { isSuspicious: true, reason: "reward_spike_detected" };
        }
    }
    catch {
        return { isSuspicious: false };
    }
    return { isSuspicious: false };
}
async function recordWithdrawAttempt(userId) {
    try {
        const key = buildWindowKey("fraud:withdraw", userId, WITHDRAW_SHORT_WINDOW_MS);
        const count = await incrementWindowCounter(key, Math.ceil(WITHDRAW_SHORT_WINDOW_MS / 1000) * 2);
        if (count >= WITHDRAW_ATTEMPT_LIMIT) {
            return { isSuspicious: true, reason: "withdraw_frequency_high" };
        }
    }
    catch {
        return { isSuspicious: false };
    }
    return { isSuspicious: false };
}
async function recordReferralRewardForInviter(inviterId) {
    try {
        const key = buildWindowKey("fraud:referral:reward", inviterId, REFERRAL_REWARD_BURST_WINDOW_MS);
        const count = await incrementWindowCounter(key, Math.ceil(REFERRAL_REWARD_BURST_WINDOW_MS / 1000) * 2);
        return {
            isAnomalous: count > REFERRAL_REWARD_BURST_LIMIT,
            pattern: count > REFERRAL_REWARD_BURST_LIMIT ? "inviter_reward_burst" : undefined,
            count,
            timeframeMs: REFERRAL_REWARD_BURST_WINDOW_MS,
        };
    }
    catch {
        return { isAnomalous: false, count: 0, timeframeMs: REFERRAL_REWARD_BURST_WINDOW_MS };
    }
}
async function recordReferralActivationForInviter(inviterId) {
    try {
        const key = buildWindowKey("fraud:referral:activation", inviterId, REFERRAL_ACTIVATION_BURST_WINDOW_MS);
        const count = await incrementWindowCounter(key, Math.ceil(REFERRAL_ACTIVATION_BURST_WINDOW_MS / 1000) * 2);
        return {
            isAnomalous: count > REFERRAL_ACTIVATION_BURST_LIMIT,
            pattern: count > REFERRAL_ACTIVATION_BURST_LIMIT ? "activation_burst" : undefined,
            count,
            timeframeMs: REFERRAL_ACTIVATION_BURST_WINDOW_MS,
        };
    }
    catch {
        return { isAnomalous: false, count: 0, timeframeMs: REFERRAL_ACTIVATION_BURST_WINDOW_MS };
    }
}
async function recordReferralByIp(ip) {
    try {
        const key = buildWindowKey("fraud:referral:ip", ip, REFERRAL_IP_WINDOW_MS);
        const count = await incrementWindowCounter(key, Math.ceil(REFERRAL_IP_WINDOW_MS / 1000) * 2);
        return {
            isAnomalous: count > REFERRAL_IP_LIMIT,
            pattern: count > REFERRAL_IP_LIMIT ? "ip_referral_burst" : undefined,
            count,
            timeframeMs: REFERRAL_IP_WINDOW_MS,
        };
    }
    catch {
        return { isAnomalous: false, count: 0, timeframeMs: REFERRAL_IP_WINDOW_MS };
    }
}
async function recordReferralJoinedByDevice(deviceId) {
    try {
        const key = buildWindowKey("fraud:referral:device", deviceId, REFERRAL_DEVICE_JOINED_WINDOW_MS);
        const count = await incrementWindowCounter(key, Math.ceil(REFERRAL_DEVICE_JOINED_WINDOW_MS / 1000) * 2);
        return {
            isAnomalous: count > REFERRAL_DEVICE_JOINED_LIMIT,
            pattern: count > REFERRAL_DEVICE_JOINED_LIMIT ? "device_joined_burst" : undefined,
            count,
            timeframeMs: REFERRAL_DEVICE_JOINED_WINDOW_MS,
        };
    }
    catch {
        return { isAnomalous: false, count: 0, timeframeMs: REFERRAL_DEVICE_JOINED_WINDOW_MS };
    }
}
