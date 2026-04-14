"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replayProtectionMiddleware = replayProtectionMiddleware;
const crypto_1 = require("crypto");
const apiResponse_1 = require("../utils/apiResponse");
const idempotencyKey_1 = require("../utils/idempotencyKey");
const logger_1 = require("../services/logger");
const redis_1 = require("../config/redis");
const REPLAY_WINDOW_SECONDS = 2;
const replayFallbackStore = new Map();
function getRequestUserId(req) {
    return req.userId;
}
function stableStringify(value) {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(",")}]`;
    }
    const obj = value;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(",")}}`;
}
function buildRequestHash(req) {
    const body = req.body && typeof req.body === "object" ? { ...req.body } : req.body;
    if (body && typeof body === "object") {
        delete body.idempotencyKey;
    }
    const fingerprint = {
        method: req.method,
        query: req.query,
        body,
    };
    return (0, crypto_1.createHash)("sha256").update(stableStringify(fingerprint)).digest("hex");
}
async function incrementReplayCount(replayKey) {
    if (typeof redis_1.redis.incr === "function") {
        const count = await redis_1.redis.incr(replayKey);
        if (count === 1) {
            await redis_1.redis.expire(replayKey, REPLAY_WINDOW_SECONDS);
        }
        return count;
    }
    const now = Date.now();
    const existing = replayFallbackStore.get(replayKey);
    if (!existing || existing.expiresAt <= now) {
        replayFallbackStore.set(replayKey, {
            count: 1,
            expiresAt: now + REPLAY_WINDOW_SECONDS * 1000,
        });
        return 1;
    }
    const nextCount = existing.count + 1;
    replayFallbackStore.set(replayKey, {
        count: nextCount,
        expiresAt: existing.expiresAt,
    });
    return nextCount;
}
async function replayProtectionMiddleware(req, res, next) {
    try {
        const userId = getRequestUserId(req);
        const action = `${req.baseUrl || ""}${req.path}`;
        const idempotencyKey = (0, idempotencyKey_1.extractIdempotencyKey)(req);
        if (idempotencyKey) {
            await (0, logger_1.logStructuredEvent)("replay_skipped_due_to_idempotency", {
                userId: userId ?? null,
                endpoint: action,
                idempotencyKey,
                action: "replay_bypass",
                timestamp: new Date().toISOString(),
            });
            return next();
        }
        const requestHash = buildRequestHash(req);
        const replayKey = `replay:${userId ?? "anonymous"}:${action}:${requestHash}`;
        const count = await incrementReplayCount(replayKey);
        if (count === 1) {
            await (0, logger_1.logStructuredEvent)("replay_first_request_allowed", {
                userId: userId ?? null,
                endpoint: action,
                replayKey,
                requestHash,
                action: "replay_allow_first",
                timestamp: new Date().toISOString(),
            });
            return next();
        }
        await (0, logger_1.logStructuredEvent)("replay_blocked_duplicate", {
            userId: userId ?? null,
            endpoint: action,
            idempotencyKey: null,
            replayKey,
            requestHash,
            count,
            action: "replay_block_duplicate",
            timestamp: new Date().toISOString(),
        });
        await (0, logger_1.logError)(new Error("Replay request blocked"), {
            endpoint: action,
            userId: userId ?? null,
            replayKey,
            requestHash,
            count,
        });
        return res.status(409).json((0, apiResponse_1.structuredError)("REPLAY_ATTACK", "Duplicate request detected"));
    }
    catch (err) {
        await (0, logger_1.logError)(err instanceof Error ? err : new Error(String(err)), {
            endpoint: `${req.baseUrl || ""}${req.path}`,
            userId: getRequestUserId(req) ?? null,
            phase: "replay_protection",
        });
        await (0, logger_1.logStructuredEvent)("replay_protection_error_fallback_allow", {
            userId: getRequestUserId(req) ?? null,
            endpoint: `${req.baseUrl || ""}${req.path}`,
            message: err instanceof Error ? err.message : String(err),
            timestamp: new Date().toISOString(),
        });
        return next();
    }
}
