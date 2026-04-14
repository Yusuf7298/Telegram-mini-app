"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replayProtectionMiddleware = replayProtectionMiddleware;
const apiResponse_1 = require("../utils/apiResponse");
const idempotencyKey_1 = require("../utils/idempotencyKey");
const logger_1 = require("../services/logger");
function getRequestUserId(req) {
    return req.userId;
}
async function replayProtectionMiddleware(req, res, next) {
    try {
        const userId = getRequestUserId(req);
        const endpoint = `${req.baseUrl || ""}${req.path}`;
        const idempotencyKey = (0, idempotencyKey_1.extractIdempotencyKey)(req);
        if (idempotencyKey) {
            // Idempotent requests bypass replay protection completely.
            await (0, logger_1.logStructuredEvent)("replay_skipped_due_to_idempotency", {
                userId: userId ?? null,
                endpoint,
                idempotencyKey,
                action: "replay_bypass",
                timestamp: new Date().toISOString(),
            });
            return next();
        }
        await (0, logger_1.logStructuredEvent)("replay_blocked_missing_idempotency", {
            userId: userId ?? null,
            endpoint,
            idempotencyKey: null,
            action: "replay_block_missing_idempotency",
            timestamp: new Date().toISOString(),
        });
        return res
            .status((0, apiResponse_1.getErrorStatus)("REPLAY_ATTACK"))
            .json((0, apiResponse_1.structuredError)("REPLAY_ATTACK", "idempotencyKey is required for protected actions"));
    }
    catch (err) {
        return res.status((0, apiResponse_1.getErrorStatus)("INVALID_INPUT")).json((0, apiResponse_1.structuredError)("INVALID_INPUT", err.message));
    }
}
