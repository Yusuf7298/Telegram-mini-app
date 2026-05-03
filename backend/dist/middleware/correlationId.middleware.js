"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.correlationIdMiddleware = correlationIdMiddleware;
const crypto_1 = __importDefault(require("crypto"));
const requestContext_service_1 = require("../services/requestContext.service");
function resolveCorrelationId(req) {
    const headerValue = req.headers["x-correlation-id"];
    const normalizedHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const candidate = typeof normalizedHeader === "string" ? normalizedHeader.trim() : "";
    if (candidate) {
        return candidate;
    }
    if (typeof crypto_1.default.randomUUID === "function") {
        return crypto_1.default.randomUUID();
    }
    return `corr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
function correlationIdMiddleware(req, res, next) {
    const correlationId = resolveCorrelationId(req);
    req.correlationId = correlationId;
    res.setHeader("X-Correlation-Id", correlationId);
    (0, requestContext_service_1.runWithRequestContext)({
        correlationId,
        requestMethod: req.method,
        requestPath: req.originalUrl,
    }, () => {
        next();
    });
}
