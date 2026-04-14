"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitRedisMiddleware = rateLimitRedisMiddleware;
const redis_1 = require("../config/redis");
const suspiciousActionLog_service_1 = require("../services/suspiciousActionLog.service");
const logger_1 = require("../services/logger");
const apiResponse_1 = require("../utils/apiResponse");
const USER_LIMIT = 30; // per minute
const GLOBAL_LIMIT = 200; // per minute
const WINDOW_MS = 60 * 1000; // 1 minute
const FREE_BOX_WINDOW_MS = 60 * 60 * 1000;
const BURST_WINDOW_MS = 2 * 1000;
const BURST_LIMIT = 5;
const IP_LIMIT = 30;
const ATOMIC_RATE_LIMIT_LUA = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("TTL", KEYS[1])
return {current, ttl}
`;
const ACTION_LIMITS = {
    "POST:/api/game/open-box": { limit: 10, windowMs: WINDOW_MS },
    "POST:/api/game/free-box": { limit: 1, windowMs: FREE_BOX_WINDOW_MS },
    "POST:/api/wallet/deposit": { limit: 5, windowMs: WINDOW_MS },
    "POST:/api/wallet/withdraw": { limit: 3, windowMs: WINDOW_MS },
    "POST:/api/auth/telegram-login": { limit: 5, windowMs: WINDOW_MS },
    "POST:/api/referral/use": { limit: 3, windowMs: WINDOW_MS },
};
async function checkSlidingWindow(key, limit, windowMs = WINDOW_MS) {
    try {
        const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
        const evalRaw = await redis_1.redis.eval(ATOMIC_RATE_LIMIT_LUA, 1, key, String(windowSeconds));
        if (!Array.isArray(evalRaw) || evalRaw.length < 2) {
            return null;
        }
        const count = parseInt(String(evalRaw[0]), 10);
        const ttlRaw = parseInt(String(evalRaw[1]), 10);
        const ttlSeconds = ttlRaw > 0 ? ttlRaw : windowSeconds;
        if (!Number.isFinite(count) || count < 0) {
            return null;
        }
        return { count, ttlSeconds };
    }
    catch (err) {
        (0, logger_1.logError)(err, { key, limit });
        return null; // fail closed
    }
}
function normalizeRouteAction(req) {
    return `${req.method.toUpperCase()}:${req.baseUrl}${req.path}`;
}
function getRequestUserId(req) {
    return req.userId;
}
function logRateLimitDebug(params) {
    void (0, logger_1.logDebug)("rate_limit_debug", {
        endpoint: `${params.req.baseUrl}${params.req.path}`,
        action: params.action,
        userId: params.userId ?? "unknown",
        originalUrl: params.req.originalUrl,
        path: params.req.path,
        baseUrl: params.req.baseUrl,
        keySource: params.keySource ?? null,
        redisKey: params.redisKey,
        count: params.count,
        limit: params.limit,
    });
}
function setRateLimitHeaders(res, limit, currentCount, ttlSeconds) {
    const remaining = Math.max(0, limit - currentCount);
    const resetEpochSeconds = Math.floor(Date.now() / 1000) + Math.max(0, ttlSeconds);
    res.setHeader("X-RateLimit-Limit", String(limit));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(resetEpochSeconds));
}
async function rateLimitRedisMiddleware(req, res, next) {
    const userId = getRequestUserId(req);
    const ip = req.ip || req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() || "unknown";
    const action = normalizeRouteAction(req);
    const actionLimitConfig = ACTION_LIMITS[action] ?? { limit: USER_LIMIT, windowMs: WINDOW_MS };
    // Only apply this additional per-user guard when a user is authenticated.
    if (userId) {
        const userKey = `rate:user:${userId}`;
        const userRate = await checkSlidingWindow(userKey, USER_LIMIT);
        if (userRate === null) {
            await (0, suspiciousActionLog_service_1.logSuspiciousAction)({ userId, type: "rate_limit_redis_unavailable" });
            return res.status((0, apiResponse_1.getErrorStatus)("RATE_LIMIT")).json((0, apiResponse_1.structuredError)("RATE_LIMIT", "Rate limit check failed. Try again later."));
        }
        if (userRate.count > USER_LIMIT) {
            await (0, logger_1.logStructuredEvent)("rate_limit_hit", {
                userId,
                action,
                count: userRate.count,
                limit: USER_LIMIT,
                scope: "user",
                timestamp: new Date().toISOString(),
            });
            await (0, suspiciousActionLog_service_1.logSuspiciousAction)({ userId, type: "rate_limit_user_exceeded", metadata: { count: userRate.count } });
            return res.status((0, apiResponse_1.getErrorStatus)("RATE_LIMIT")).json((0, apiResponse_1.structuredError)("RATE_LIMIT", "Too many requests (user)"));
        }
    }
    const actionKey = userId
        ? `rate:user:${userId}:action:${action}`
        : `rate:ip:${ip}:action:${action}`;
    const actionRate = await checkSlidingWindow(actionKey, actionLimitConfig.limit, actionLimitConfig.windowMs);
    const actionKeySource = userId ? "userId" : "ip";
    logRateLimitDebug({
        req,
        action,
        userId,
        keySource: actionKeySource,
        redisKey: actionKey,
        count: actionRate?.count ?? null,
        limit: actionLimitConfig.limit,
    });
    if (actionRate === null) {
        if (userId) {
            await (0, suspiciousActionLog_service_1.logSuspiciousAction)({ userId, type: "rate_limit_redis_unavailable_action", metadata: { action } });
        }
        return res.status((0, apiResponse_1.getErrorStatus)("RATE_LIMIT")).json((0, apiResponse_1.structuredError)("RATE_LIMIT", "Rate limit check failed. Try again later."));
    }
    setRateLimitHeaders(res, actionLimitConfig.limit, actionRate.count, actionRate.ttlSeconds);
    if (actionRate.count > actionLimitConfig.limit) {
        await (0, logger_1.logStructuredEvent)("rate_limit_hit", {
            userId: userId ?? null,
            action,
            count: actionRate.count,
            limit: actionLimitConfig.limit,
            scope: "action",
            keySource: actionKeySource,
            ip,
            timestamp: new Date().toISOString(),
        });
        if (userId) {
            await (0, suspiciousActionLog_service_1.logSuspiciousAction)({
                userId,
                type: "rapid_play",
                metadata: {
                    action,
                    count: actionRate.count,
                    scope: "user_action",
                    keySource: actionKeySource,
                },
            });
        }
        return res.status((0, apiResponse_1.getErrorStatus)("RATE_LIMIT")).json((0, apiResponse_1.structuredError)("RATE_LIMIT", "Rate limit exceeded"));
    }
    const ipKey = `rate:ip:${ip}`;
    const ipRate = await checkSlidingWindow(ipKey, IP_LIMIT);
    logRateLimitDebug({
        req,
        action,
        userId,
        keySource: "ip",
        redisKey: ipKey,
        count: ipRate?.count ?? null,
        limit: IP_LIMIT,
    });
    if (ipRate === null) {
        if (userId) {
            await (0, suspiciousActionLog_service_1.logSuspiciousAction)({ userId, type: "rate_limit_redis_unavailable_ip", metadata: { action } });
        }
        return res.status((0, apiResponse_1.getErrorStatus)("RATE_LIMIT")).json((0, apiResponse_1.structuredError)("RATE_LIMIT", "Rate limit check failed. Try again later."));
    }
    if (ipRate.count > IP_LIMIT) {
        await (0, logger_1.logStructuredEvent)("rate_limit_hit", {
            userId: userId ?? null,
            action,
            count: ipRate.count,
            limit: IP_LIMIT,
            scope: "ip",
            ip,
            timestamp: new Date().toISOString(),
        });
        if (userId) {
            await (0, suspiciousActionLog_service_1.logSuspiciousAction)({
                userId,
                type: "multi_account_same_ip",
                metadata: { action, count: ipRate.count, ip },
            });
        }
        return res.status((0, apiResponse_1.getErrorStatus)("RATE_LIMIT")).json((0, apiResponse_1.structuredError)("RATE_LIMIT", "Too many requests from this IP"));
    }
    const burstKey = userId
        ? `rate:burst:user:${userId}:action:${action}`
        : `rate:burst:ip:${ip}:action:${action}`;
    const burstRate = await checkSlidingWindow(burstKey, BURST_LIMIT, BURST_WINDOW_MS);
    const burstKeySource = userId ? "userId" : "ip";
    logRateLimitDebug({
        req,
        action,
        userId,
        keySource: burstKeySource,
        redisKey: burstKey,
        count: burstRate?.count ?? null,
        limit: BURST_LIMIT,
    });
    if (burstRate === null) {
        if (userId) {
            await (0, suspiciousActionLog_service_1.logSuspiciousAction)({ userId, type: "rate_limit_redis_unavailable_burst", metadata: { action } });
        }
        return res.status((0, apiResponse_1.getErrorStatus)("RATE_LIMIT")).json((0, apiResponse_1.structuredError)("RATE_LIMIT", "Rate limit check failed. Try again later."));
    }
    if (burstRate.count > BURST_LIMIT) {
        await (0, logger_1.logStructuredEvent)("rate_limit_hit", {
            userId: userId ?? null,
            action,
            count: burstRate.count,
            limit: BURST_LIMIT,
            scope: "burst",
            keySource: burstKeySource,
            ip,
            timestamp: new Date().toISOString(),
        });
        if (userId) {
            await (0, suspiciousActionLog_service_1.logSuspiciousAction)({
                userId,
                type: "rapid_play",
                metadata: {
                    action,
                    count: burstRate.count,
                    scope: "burst",
                    burstWindowMs: BURST_WINDOW_MS,
                    keySource: burstKeySource,
                },
            });
        }
        return res.status((0, apiResponse_1.getErrorStatus)("RATE_LIMIT")).json((0, apiResponse_1.structuredError)("RATE_LIMIT", "Request burst detected"));
    }
    // Global
    const globalKey = "rate:global";
    const globalRate = await checkSlidingWindow(globalKey, GLOBAL_LIMIT);
    if (globalRate === null) {
        if (userId) {
            await (0, suspiciousActionLog_service_1.logSuspiciousAction)({ userId, type: "rate_limit_redis_unavailable_global" });
        }
        return res.status((0, apiResponse_1.getErrorStatus)("RATE_LIMIT")).json((0, apiResponse_1.structuredError)("RATE_LIMIT", "Rate limit check failed. Try again later."));
    }
    if (globalRate.count > GLOBAL_LIMIT) {
        await (0, logger_1.logStructuredEvent)("rate_limit_hit", {
            userId: userId ?? null,
            action,
            count: globalRate.count,
            limit: GLOBAL_LIMIT,
            scope: "global",
            ip,
            timestamp: new Date().toISOString(),
        });
        if (userId) {
            await (0, suspiciousActionLog_service_1.logSuspiciousAction)({ userId, type: "rate_limit_global_exceeded", metadata: { count: globalRate.count } });
        }
        return res.status((0, apiResponse_1.getErrorStatus)("RATE_LIMIT")).json((0, apiResponse_1.structuredError)("RATE_LIMIT", "Too many requests (global)"));
    }
    next();
}
