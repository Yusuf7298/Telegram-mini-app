"use strict";
// Unified API response helpers for all endpoints
// Ensures: { success, data, error } structure
// No stack traces in production, safe error messages, Unity-friendly
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorStatus = getErrorStatus;
exports.successResponse = successResponse;
exports.errorResponse = errorResponse;
exports.structuredError = structuredError;
const ERROR_STATUS = {
    RATE_LIMIT: 429,
    REPLAY_ATTACK: 409,
    INSUFFICIENT_FUNDS: 400,
    INVALID_INPUT: 422,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_ERROR: 500,
};
function inferErrorCode(message) {
    const normalized = message.toLowerCase();
    if (normalized.includes("rate limit") || normalized.includes("too many requests") || normalized.includes("burst")) {
        return "RATE_LIMIT";
    }
    if (normalized.includes("replay") || normalized.includes("duplicate") || normalized.includes("signature")) {
        return "REPLAY_ATTACK";
    }
    if (normalized.includes("insufficient")) {
        return "INSUFFICIENT_FUNDS";
    }
    if (normalized.includes("required") ||
        normalized.includes("invalid") ||
        normalized.includes("validation") ||
        normalized.includes("missing")) {
        return "INVALID_INPUT";
    }
    if (normalized.includes("unauthorized") || normalized.includes("auth")) {
        return "UNAUTHORIZED";
    }
    if (normalized.includes("forbidden") || normalized.includes("access required")) {
        return "FORBIDDEN";
    }
    if (normalized.includes("not found")) {
        return "NOT_FOUND";
    }
    return "INTERNAL_ERROR";
}
function getErrorStatus(code) {
    return ERROR_STATUS[code] ?? 500;
}
function successResponse(data = null) {
    return {
        success: true,
        data,
        error: null,
    };
}
function errorResponse(message, opts) {
    const safeMsg = opts?.production || process.env.NODE_ENV === "production"
        ? sanitizeErrorMessage(message)
        : message;
    return {
        success: false,
        error: {
            code: opts?.code ?? inferErrorCode(safeMsg),
            message: safeMsg,
        },
    };
}
function structuredError(code, message, opts) {
    return errorResponse(message, { ...opts, code });
}
function sanitizeErrorMessage(msg) {
    if (!msg)
        return "An error occurred";
    if (/stack|sql|prisma|trace|exception|database|failed/i.test(msg)) {
        return "An error occurred";
    }
    if (msg.length > 120)
        return "An error occurred";
    return msg;
}
