"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalErrorHandler = globalErrorHandler;
function isPrismaConnectivityError(error) {
    const err = error;
    const code = err.code ?? err.meta?.code;
    const message = String(err.message ?? "");
    return (code === "P1001" ||
        /connection terminated unexpectedly/i.test(message) ||
        /server closed the connection/i.test(message) ||
        /connection error/i.test(message) ||
        /timed out/i.test(message) ||
        /timeout/i.test(message));
}
function buildLogContext(req) {
    const correlationIdHeader = req.headers["x-correlation-id"];
    const correlationId = Array.isArray(correlationIdHeader)
        ? correlationIdHeader[0]
        : correlationIdHeader;
    return {
        method: req.method,
        path: req.originalUrl,
        correlationId: typeof correlationId === "string" ? correlationId : undefined,
        userId: req.userId ?? undefined,
    };
}
function globalErrorHandler(err, req, res, _next) {
    const context = buildLogContext(req);
    const isPrismaConnectivityIssue = isPrismaConnectivityError(err);
    const safeMessage = "Temporary server issue";
    console.error("Unhandled request error", {
        ...context,
        prismaConnectivityIssue: isPrismaConnectivityIssue,
        error: err,
    });
    if (res.headersSent) {
        return;
    }
    res.status(500).json({ error: safeMessage });
}
