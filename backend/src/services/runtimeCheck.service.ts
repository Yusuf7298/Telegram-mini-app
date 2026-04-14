import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "../config/db";
import { redis } from "../config/redis";
import { createIdempotencyKey, checkIdempotencyKey, completeIdempotencyKey } from "./idempotency.service";
import { verifyWalletConstraintIntegrity } from "./systemStats.service";

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

async function runRedisCheck(): Promise<boolean> {
  const pong = await redis.ping();
  return pong === "PONG";
}

async function runIdempotencyReplayCheck(): Promise<boolean> {
  let checkPassed = false;

  try {
    await prisma.$transaction(async (tx) => {
      const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
      const user = await tx.user.create({
        data: {
          platformId: `runtime-idem-${suffix}`,
          referralCode: `RIDEM${suffix.toUpperCase()}`,
          wallet: {
            create: {
              cashBalance: new Prisma.Decimal(0),
              bonusBalance: new Prisma.Decimal(0),
            },
          },
        },
      });

      const keyId = `runtime-check-idem-${suffix}`;
      await createIdempotencyKey({ id: keyId, userId: user.id, action: "runtimeCheck", tx });
      await completeIdempotencyKey({
        id: keyId,
        userId: user.id,
        response: { reward: "10", balances: { cashBalance: "10", bonusBalance: "0", totalBalance: "10" } },
        metadata: { source: "runtime-check" },
        tx,
      });

      let duplicateBlocked = false;
      try {
        await createIdempotencyKey({ id: keyId, userId: user.id, action: "runtimeCheck", tx });
      } catch {
        duplicateBlocked = true;
      }

      const replay = await checkIdempotencyKey({ id: keyId, userId: user.id, tx });
      checkPassed =
        duplicateBlocked &&
        replay?.status === "COMPLETED" &&
        (replay as any)?.response?.success === true &&
        typeof (replay as any)?.response?.data?.reward === "string";

      throw new RuntimeCheckRollback();
    });
  } catch (err: unknown) {
    if (!(err instanceof RuntimeCheckRollback)) {
      throw err;
    }
  }

  return checkPassed;
}

async function runRateLimitCheck(): Promise<boolean> {
  const key = `runtime-check-rate:${randomUUID()}`;
  const limit = 3;
  const windowSeconds = 60;

  try {
    let lastCount = 0;
    for (let i = 0; i < limit + 1; i++) {
      const countRaw = await redis.eval(RATE_LIMIT_LUA, 1, key, String(windowSeconds));
      lastCount = typeof countRaw === "number" ? countRaw : parseInt(String(countRaw), 10);
    }

    return lastCount > limit;
  } finally {
    await redis.del(key);
  }
}

export async function runRuntimeCheck() {
  const checks = {
    db: false,
    redis: false,
    idempotency: false,
    rateLimit: false,
  };

  try {
    const dbCheck = await verifyWalletConstraintIntegrity();
    checks.db = dbCheck.valid && dbCheck.checks.walletNonNegativeBalanceConstraint;
  } catch {
    checks.db = false;
  }

  try {
    checks.redis = await runRedisCheck();
  } catch {
    checks.redis = false;
  }

  try {
    checks.idempotency = await runIdempotencyReplayCheck();
  } catch {
    checks.idempotency = false;
  }

  try {
    checks.rateLimit = await runRateLimitCheck();
  } catch {
    checks.rateLimit = false;
  }

  return {
    ok: checks.db && checks.redis && checks.idempotency && checks.rateLimit,
    checks,
  };
}
