"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRuntimeCheck = runRuntimeCheck;
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const db_1 = require("../config/db");
const redis_1 = require("../config/redis");
const idempotency_service_1 = require("./idempotency.service");
const systemStats_service_1 = require("./systemStats.service");
const RATE_LIMIT_LUA = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return current
`;
class RuntimeCheckRollback extends Error {
    constructor() {
        super("runtime-check-rollback");
        this.name = "RuntimeCheckRollback";
    }
}
async function runRedisCheck() {
    const pong = await redis_1.redis.ping();
    return pong === "PONG";
}
async function runIdempotencyReplayCheck() {
    let checkPassed = false;
    try {
        await db_1.prisma.$transaction(async (tx) => {
            const suffix = (0, crypto_1.randomUUID)().replace(/-/g, "").slice(0, 12);
            const user = await tx.user.create({
                data: {
                    platformId: `runtime-idem-${suffix}`,
                    referralCode: `RIDEM${suffix.toUpperCase()}`,
                    wallet: {
                        create: {
                            cashBalance: new client_1.Prisma.Decimal(0),
                            bonusBalance: new client_1.Prisma.Decimal(0),
                        },
                    },
                },
            });
            const keyId = `runtime-check-idem-${suffix}`;
            await (0, idempotency_service_1.createIdempotencyKey)({ id: keyId, userId: user.id, action: "runtimeCheck", tx });
            await (0, idempotency_service_1.completeIdempotencyKey)({
                id: keyId,
                userId: user.id,
                response: { reward: "10", balances: { cashBalance: "10", bonusBalance: "0", totalBalance: "10" } },
                metadata: { source: "runtime-check" },
                tx,
            });
            let duplicateBlocked = false;
            try {
                await (0, idempotency_service_1.createIdempotencyKey)({ id: keyId, userId: user.id, action: "runtimeCheck", tx });
            }
            catch {
                duplicateBlocked = true;
            }
            const replay = await (0, idempotency_service_1.checkIdempotencyKey)({ id: keyId, userId: user.id, tx });
            checkPassed =
                duplicateBlocked &&
                    replay?.status === "COMPLETED" &&
                    replay?.response?.success === true &&
                    typeof replay?.response?.data?.reward === "string";
            throw new RuntimeCheckRollback();
        });
    }
    catch (err) {
        if (!(err instanceof RuntimeCheckRollback)) {
            throw err;
        }
    }
    return checkPassed;
}
async function runRateLimitCheck() {
    const key = `runtime-check-rate:${(0, crypto_1.randomUUID)()}`;
    const limit = 3;
    const windowSeconds = 60;
    try {
        let lastCount = 0;
        for (let i = 0; i < limit + 1; i++) {
            const countRaw = await redis_1.redis.eval(RATE_LIMIT_LUA, 1, key, String(windowSeconds));
            lastCount = typeof countRaw === "number" ? countRaw : parseInt(String(countRaw), 10);
        }
        return lastCount > limit;
    }
    finally {
        await redis_1.redis.del(key);
    }
}
async function runRuntimeCheck() {
    const checks = {
        db: false,
        redis: false,
        idempotency: false,
        rateLimit: false,
    };
    try {
        const dbCheck = await (0, systemStats_service_1.verifyWalletConstraintIntegrity)();
        checks.db = dbCheck.valid && dbCheck.checks.walletNonNegativeBalanceConstraint;
    }
    catch {
        checks.db = false;
    }
    try {
        checks.redis = await runRedisCheck();
    }
    catch {
        checks.redis = false;
    }
    try {
        checks.idempotency = await runIdempotencyReplayCheck();
    }
    catch {
        checks.idempotency = false;
    }
    try {
        checks.rateLimit = await runRateLimitCheck();
    }
    catch {
        checks.rateLimit = false;
    }
    return {
        ok: checks.db && checks.redis && checks.idempotency && checks.rateLimit,
        checks,
    };
}
