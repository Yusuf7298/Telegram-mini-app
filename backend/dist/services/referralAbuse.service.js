"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforceReferralAbuseGuards = enforceReferralAbuseGuards;
const redis_1 = require("../config/redis");
const DAY_WINDOW_SECONDS = 24 * 60 * 60;
const MAX_REFERRAL_ATTEMPTS_PER_USER_PER_DAY = 10;
const MAX_REFERRALS_PER_DEVICE_PER_DAY = 3;
function getDayBucketUtc(date = new Date()) {
    return date.toISOString().slice(0, 10);
}
async function incrementWithTtl(key, ttlSeconds) {
    const count = await redis_1.redis.incr(key);
    if (count === 1) {
        await redis_1.redis.expire(key, ttlSeconds);
    }
    return count;
}
function normalizeFingerprint(values) {
    const first = values.find((value) => typeof value === "string" &&
        value.trim().length > 0 &&
        value.trim().toLowerCase() !== "unknown");
    return first?.trim() || undefined;
}
async function enforceReferralAbuseGuards(input) {
    const { tx, referredUserId, inviterId, ip, deviceId, invitedTelegramId, inviterTelegramId, invitedSignupDeviceId, invitedDeviceHash, maxReferralsPerIpPerDay, } = input;
    if (invitedTelegramId && inviterTelegramId && invitedTelegramId === inviterTelegramId) {
        return {
            allowed: false,
            reason: "self_referral_telegram_match",
            details: {
                invitedTelegramId,
            },
        };
    }
    const fingerprint = normalizeFingerprint([invitedDeviceHash, invitedSignupDeviceId, deviceId]);
    if (fingerprint) {
        const reusedFingerprintCount = await tx.user.count({
            where: {
                id: { not: referredUserId },
                referredById: { not: null },
                OR: [{ deviceHash: fingerprint }, { signupDeviceId: fingerprint }],
            },
        });
        if (reusedFingerprintCount > 0) {
            return {
                allowed: false,
                reason: "repeated_fingerprint_join",
                details: {
                    fingerprint,
                    matchedUsers: reusedFingerprintCount,
                },
            };
        }
    }
    const bucket = getDayBucketUtc();
    const safeIp = ip || "unknown";
    const safeDevice = normalizeFingerprint([deviceId, invitedSignupDeviceId, invitedDeviceHash]);
    const ipKey = `referral:attempt:ip:${bucket}:${safeIp}`;
    const userKey = `referral:attempt:user:${bucket}:${referredUserId}`;
    const deviceKey = safeDevice ? `referral:attempt:device:${bucket}:${safeDevice}` : null;
    const inviterDeviceKey = safeDevice ? `referral:join:fingerprint:${bucket}:${inviterId}:${safeDevice}` : null;
    try {
        const [ipCount, deviceCount, userCount, fingerprintJoinCount] = await Promise.all([
            incrementWithTtl(ipKey, DAY_WINDOW_SECONDS),
            deviceKey ? incrementWithTtl(deviceKey, DAY_WINDOW_SECONDS) : Promise.resolve(0),
            incrementWithTtl(userKey, DAY_WINDOW_SECONDS),
            inviterDeviceKey ? incrementWithTtl(inviterDeviceKey, DAY_WINDOW_SECONDS) : Promise.resolve(0),
        ]);
        if (ipCount > maxReferralsPerIpPerDay) {
            return {
                allowed: false,
                reason: "ip_daily_limit_exceeded",
                details: {
                    ip: safeIp,
                    count: ipCount,
                    limit: maxReferralsPerIpPerDay,
                },
            };
        }
        if (safeDevice && (deviceCount > MAX_REFERRALS_PER_DEVICE_PER_DAY || fingerprintJoinCount > ONE)) {
            return {
                allowed: false,
                reason: "device_daily_limit_exceeded",
                details: {
                    deviceId: safeDevice,
                    count: Math.max(deviceCount, fingerprintJoinCount),
                    limit: MAX_REFERRALS_PER_DEVICE_PER_DAY,
                    fingerprintJoinCount,
                },
            };
        }
        if (userCount > MAX_REFERRAL_ATTEMPTS_PER_USER_PER_DAY) {
            return {
                allowed: false,
                reason: "user_daily_limit_exceeded",
                details: {
                    referredUserId,
                    count: userCount,
                    limit: MAX_REFERRAL_ATTEMPTS_PER_USER_PER_DAY,
                },
            };
        }
        return { allowed: true };
    }
    catch {
        // Fail-open on Redis outage; DB checks still run in canUseReferral.
        return { allowed: true };
    }
}
const ONE = 1;
