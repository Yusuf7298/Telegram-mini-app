"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openBoxRateLimit = openBoxRateLimit;
exports.freeBoxRateLimit = freeBoxRateLimit;
const redis_1 = require("../config/redis");
const OPEN_BOX_MAX_REQUESTS = 10;
const OPEN_BOX_WINDOW_SECONDS = 10;
const FREE_BOX_SECONDS = 60 * 60 * 24 * 365 * 10;
function getUserId(req) {
    const userId = req.userId;
    if (typeof userId !== "string" || userId.trim().length === 0) {
        return null;
    }
    return userId;
}
function tooManyRequests(res, message) {
    return res.status(429).json({
        success: false,
        error: message,
    });
}
async function openBoxRateLimit(req, res, next) {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({
            success: false,
            error: "Unauthorized",
        });
    }
    try {
        const key = `rl:open-box:${userId}`;
        const count = await redis_1.redis.incr(key);
        if (count === 1) {
            await redis_1.redis.expire(key, OPEN_BOX_WINDOW_SECONDS);
        }
        if (count > OPEN_BOX_MAX_REQUESTS) {
            return tooManyRequests(res, "Too many open-box requests. Try again in a few seconds.");
        }
        return next();
    }
    catch (error) {
        return res.status(503).json({
            success: false,
            error: "Rate limiting service unavailable",
        });
    }
}
async function freeBoxRateLimit(req, res, next) {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({
            success: false,
            error: "Unauthorized",
        });
    }
    try {
        const key = `rl:free-box:${userId}`;
        const result = await redis_1.redis.set(key, "1", "EX", FREE_BOX_SECONDS, "NX");
        if (result !== "OK") {
            return tooManyRequests(res, "Free box request limit exceeded for this user.");
        }
        return next();
    }
    catch (error) {
        return res.status(503).json({
            success: false,
            error: "Rate limiting service unavailable",
        });
    }
}
