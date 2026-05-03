"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withRetry = withRetry;
exports.withTransactionRetry = withTransactionRetry;
// Generic retry wrapper for DB operations
async function withRetry(fn, retries = 3) {
    let attempt = 0;
    let delay = 50;
    while (attempt < retries) {
        try {
            return await fn();
        }
        catch (err) {
            // Deadlock or transient error codes (Postgres)
            const code = err.code || err?.meta?.code;
            const isDeadlock = code === '40001' || code === '40P01' || code === 'P2034';
            const isTransient = code === '57014' || code === '57P01' || code === '53300' || code === '55000' || code === '08006' || code === '08000';
            const isPrismaTxTimeout = code === 'P2028' ||
                code === 'P1001' ||
                /unable to start a transaction in the given time/i.test(String(err?.message || '')) ||
                /transaction api error/i.test(String(err?.message || ''));
            const isConnectionDrop = /connection error/i.test(String(err?.message || '')) ||
                /not queryable/i.test(String(err?.message || '')) ||
                /client has encountered/i.test(String(err?.message || '')) ||
                /terminating connection/i.test(String(err?.message || '')) ||
                /ECONNRESET|EPIPE|ETIMEDOUT/i.test(String(err?.message || ''));
            const isUpdateManyZero = err.message && /update.*count.*0/i.test(err.message);
            if (isDeadlock || isTransient || isPrismaTxTimeout || isConnectionDrop || isUpdateManyZero) {
                attempt++;
                if (attempt >= retries)
                    throw err;
                await new Promise((res) => setTimeout(res, delay));
                delay *= 2;
            }
            else {
                throw err;
            }
        }
    }
    throw new Error('Operation failed after maximum retries');
}
async function withTransactionRetry(prisma, fn, maxRetries = 6) {
    return withRetry(() => prisma.$transaction(async (tx) => fn(tx), {
        maxWait: 180000,
        timeout: 600000,
    }), maxRetries);
}
