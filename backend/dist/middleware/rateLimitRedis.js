"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitRedisMiddleware = rateLimitRedisMiddleware;
const redis_1 = require("../config/redis");
const suspiciousActionLog_service_1 = require("../services/suspiciousActionLog.service");
const logger_1 = require("../services/logger");
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
return current
`;
const ACTION_LIMITS = {
    "POST:/api/game/open-box": { limit: 10, windowMs: WINDOW_MS },
    "POST:/api/game/free-box": { limit: 1, windowMs: FREE_BOX_WINDOW_MS },
    "POST:/api/wallet/withdraw": { limit: 3, windowMs: WINDOW_MS },
};
async function checkSlidingWindow(key, limit, windowMs = WINDOW_MS) {
    try {
        const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
        const countRaw = await redis_1.redis.eval(ATOMIC_RATE_LIMIT_LUA, 1, key, String(windowSeconds));
        const count = typeof countRaw === "number" ? countRaw : parseInt(String(countRaw), 10);
        return count;
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
    console.log("[RateLimitDebug]", {
        originalUrl: params.req.originalUrl,
        path: params.req.path,
        baseUrl: params.req.baseUrl,
        action: params.action,
        userId: params.userId ?? null,
        redisKey: params.redisKey,
        count: params.count,
        limit: params.limit,
    });
}
async function rateLimitRedisMiddleware(req, res, next) {
    const userId = getRequestUserId(req);
    const ip = req.ip || req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() || "unknown";
    const action = normalizeRouteAction(req);
    const actionLimitConfig = ACTION_LIMITS[action] ?? { limit: USER_LIMIT, windowMs: WINDOW_MS };
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    // Per-user
    const userKey = `rate:user:${userId}`;
    const userCount = await checkSlidingWindow(userKey, USER_LIMIT);
    if (userCount === null) {
        // Redis unavailable, fail closed
        await (0, suspiciousActionLog_service_1.logSuspiciousAction)({ userId, type: "rate_limit_redis_unavailable" });
        return res.status(429).json({ error: "Rate limit check failed. Try again later." });
    }
    if (userCount > USER_LIMIT) {
        await (0, suspiciousActionLog_service_1.logSuspiciousAction)({ userId, type: "rate_limit_user_exceeded", metadata: { count: userCount } });
        return res.status(429).json({ error: "Too many requests (user)" });
    }
    const userActionKey = `rate:user:${userId}:action:${action}`;
    const userActionCount = await checkSlidingWindow(userActionKey, actionLimitConfig.limit, actionLimitConfig.windowMs);
    logRateLimitDebug({
        req,
        action,
        userId,
        redisKey: userActionKey,
        count: userActionCount,
        limit: actionLimitConfig.limit,
    });
    if (userActionCount === null) {
        await (0, suspiciousActionLog_service_1.logSuspiciousAction)({ userId, type: "rate_limit_redis_unavailable_action", metadata: { action } });
        return res.status(429).json({ error: "Rate limit check failed. Try again later." });
    }
    if (userActionCount > actionLimitConfig.limit) {
        await (0, suspiciousActionLog_service_1.logSuspiciousAction)({
            userId,
            type: "rapid_play",
            metadata: {
                action,
                count: userActionCount,
                scope: "user_action",
            },
        });
        return res.status(429).json({ error: "Rate limit exceeded" });
    }
    const ipKey = `rate:ip:${ip}`;
    const ipCount = await checkSlidingWindow(ipKey, IP_LIMIT);
    logRateLimitDebug({
        req,
        action,
        userId,
        redisKey: ipKey,
        count: ipCount,
        limit: IP_LIMIT,
    });
    if (ipCount === null) {
        await (0, suspiciousActionLog_service_1.logSuspiciousAction)({ userId, type: "rate_limit_redis_unavailable_ip", metadata: { action } });
        return res.status(429).json({ error: "Rate limit check failed. Try again later." });
    }
    if (ipCount > IP_LIMIT) {
        await (0, suspiciousActionLog_service_1.logSuspiciousAction)({
            userId,
            type: "multi_account_same_ip",
            metadata: { action, count: ipCount, ip },
        });
        return res.status(429).json({ error: "Too many requests from this IP" });
    }
    const burstKey = `rate:burst:user:${userId}:action:${action}`;
    const burstCount = await checkSlidingWindow(burstKey, BURST_LIMIT, BURST_WINDOW_MS);
    logRateLimitDebug({
        req,
        action,
        userId,
        redisKey: burstKey,
        count: burstCount,
        limit: BURST_LIMIT,
    });
    if (burstCount === null) {
        await (0, suspiciousActionLog_service_1.logSuspiciousAction)({ userId, type: "rate_limit_redis_unavailable_burst", metadata: { action } });
        return res.status(429).json({ error: "Rate limit check failed. Try again later." });
    }
    if (burstCount > BURST_LIMIT) {
        await (0, suspiciousActionLog_service_1.logSuspiciousAction)({
            userId,
            type: "rapid_play",
            metadata: { action, count: burstCount, scope: "burst", burstWindowMs: BURST_WINDOW_MS },
        });
        return res.status(429).json({ error: "Request burst detected" });
    }
    // Global
    const globalKey = "rate:global";
    const globalCount = await checkSlidingWindow(globalKey, GLOBAL_LIMIT);
    if (globalCount === null) {
        await (0, suspiciousActionLog_service_1.logSuspiciousAction)({ userId, type: "rate_limit_redis_unavailable_global" });
        return res.status(429).json({ error: "Rate limit check failed. Try again later." });
    }
    if (globalCount > GLOBAL_LIMIT) {
        await (0, suspiciousActionLog_service_1.logSuspiciousAction)({ userId, type: "rate_limit_global_exceeded", metadata: { count: globalCount } });
        return res.status(429).json({ error: "Too many requests (global)" });
    }
    next();
}
