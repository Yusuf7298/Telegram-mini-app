"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestAuditMiddleware = requestAuditMiddleware;
function resolveUserId(req) {
    if (req.userId && req.userId.trim())
        return req.userId;
    if (req.user?.userId && req.user.userId.trim())
        return req.user.userId;
    if (req.user?.id && req.user.id.trim())
        return req.user.id;
    return null;
}
function resolveIdempotencyKey(req) {
    const bodyKey = typeof req.body?.idempotencyKey === "string" ? req.body.idempotencyKey : undefined;
    const headerKey = req.headers["x-idempotency-key"];
    const normalizedHeader = Array.isArray(headerKey) ? headerKey[0] : headerKey;
    return bodyKey?.trim() || normalizedHeader?.toString().trim() || null;
}
function buildAction(req) {
    return `${req.method.toUpperCase()}:${req.baseUrl}${req.path}`;
}
function requestAuditMiddleware(req, res, next) {
    const startedAt = process.hrtime.bigint();
    res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1000000;
        const reqWithUser = req;
        const logPayload = {
            userId: resolveUserId(reqWithUser),
            route: req.originalUrl,
            action: buildAction(req),
            idempotencyKey: resolveIdempotencyKey(req),
            status: res.statusCode,
            durationMs: Number(durationMs.toFixed(2)),
        };
        console.info("[RequestAudit]", JSON.stringify(logPayload));
    });
    next();
}
