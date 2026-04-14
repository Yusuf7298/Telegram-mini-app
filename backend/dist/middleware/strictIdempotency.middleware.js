"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.strictIdempotencyMiddleware = strictIdempotencyMiddleware;
const apiResponse_1 = require("../utils/apiResponse");
const idempotencyKey_1 = require("../utils/idempotencyKey");
function strictIdempotencyMiddleware(req, res, next) {
    const idempotencyKey = (0, idempotencyKey_1.extractIdempotencyKey)(req);
    if (!idempotencyKey) {
        return res.status(400).json((0, apiResponse_1.structuredError)("INVALID_INPUT", "idempotencyKey is required"));
    }
    return next();
}
