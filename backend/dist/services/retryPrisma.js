"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RETRY_MAX_ATTEMPTS = exports.RETRY_DELAYS_MS = void 0;
exports.isRetryablePrismaError = isRetryablePrismaError;
exports.retryPrisma = retryPrisma;
exports.withPrismaRetry = withPrismaRetry;
exports.RETRY_DELAYS_MS = [100, 300, 700];
exports.RETRY_MAX_ATTEMPTS = exports.RETRY_DELAYS_MS.length + 1;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function isRetryablePrismaError(error) {
    const err = error;
    const code = err.code ?? err.meta?.code;
    const message = String(err.message ?? "");
    const connectionErrorCodes = new Set(["P1001", "P1017", "P2024", "08000", "08006", "08003", "57P01", "57P02"]);
    if (code && connectionErrorCodes.has(code)) {
        return true;
    }
    if (code === "P2028" || code === "P2034") {
        return true;
    }
    return (/timeout/i.test(message) ||
        /timed out/i.test(message) ||
        /timeout exceeded/i.test(message) ||
        /connection terminated unexpectedly/i.test(message) ||
        /connection/i.test(message) ||
        /econnreset|econnrefused|ehostunreach|etimedout/i.test(message) ||
        /not queryable|terminating connection|server closed the connection/i.test(message));
}
async function retryPrisma(fn) {
    let attempt = 0;
    while (true) {
        try {
            return await fn();
        }
        catch (error) {
            const canRetry = isRetryablePrismaError(error);
            if (!canRetry || attempt >= exports.RETRY_DELAYS_MS.length) {
                throw error;
            }
            const jitterMs = Math.floor(Math.random() * 50);
            const waitMs = exports.RETRY_DELAYS_MS[attempt] + jitterMs;
            attempt += 1;
            await sleep(waitMs);
        }
    }
}
async function withPrismaRetry(fn) {
    return retryPrisma(fn);
}
