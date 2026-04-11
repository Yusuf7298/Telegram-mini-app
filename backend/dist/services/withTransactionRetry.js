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
            const isDeadlock = code === '40001' || code === '40P01';
            const isTransient = code === '57014' || code === '57P01' || code === '53300' || code === '55000';
            const isPrismaTxTimeout = code === 'P2028' ||
                /transaction api error/i.test(String(err?.message || ''));
            const isUpdateManyZero = err.message && /update.*count.*0/i.test(err.message);
            if (isDeadlock || isTransient || isPrismaTxTimeout || isUpdateManyZero) {
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
async function withTransactionRetry(prisma, fn, maxRetries = 3) {
    return withRetry(() => prisma.$transaction(async (tx) => fn(tx), {
        maxWait: 10000,
        timeout: 15000,
    }), maxRetries);
}
