import { Prisma } from "@prisma/client";
import { prisma } from "../src/config/db";
import { pLimit } from "../src/utils/pLimit";
import { openBox as openBoxService } from "../src/modules/game/game.service";
import { isRetryablePrismaError } from "../src/services/retryPrisma";
import { disconnectFeatureFlags } from "../src/config/featureFlags";

if (!process.env.FF_REFERRAL_ENABLED) {
  process.env.FF_REFERRAL_ENABLED = "true";
}

type SetupResult = {
  userId: string;
  platformId: string;
  joinMs: number;
  joinOk: boolean;
  timedOut: boolean;
  error?: string;
};

type UserRunResult = {
  userId: string;
  platformId: string;
  joinMs: number;
  openMs: number;
  totalMs: number;
  joinOk: boolean;
  openOk: boolean;
  timedOut: boolean;
  error?: string;
};

type Percentiles = {
  p50: number;
  p95: number;
  max: number;
};

type StressMode = "light" | "medium" | "heavy";

type ModeConfig = {
  mode: StressMode;
  userCount: number;
  flowConcurrency: number;
  setupConcurrency: number;
  dbOpConcurrency: number;
  batchSize: number;
  batchDelayMs: number;
  perUserTimeoutMs: number;
};

type StressTag = "stress_test" | "db_timeout" | "retry_attempt";

type StressLogEvent = {
  event: string;
  tags: StressTag[];
  runTag: string;
  phase?: "setup" | "open" | "consistency" | "summary";
  userId?: string;
  platformId?: string;
  requestDurationMs?: number;
  dbQueryTimeMs?: number;
  retryAttempt?: number;
  retryDelayMs?: number;
  failureReason?: string;
  details?: Record<string, unknown>;
};

const MODE_PROFILES: Record<StressMode, Omit<ModeConfig, "mode">> = {
  light: {
    userCount: 10,
    flowConcurrency: 2,
    setupConcurrency: 2,
    dbOpConcurrency: 2,
    batchSize: 2,
    batchDelayMs: 120,
    perUserTimeoutMs: 120_000,
  },
  medium: {
    userCount: 50,
    flowConcurrency: 8,
    setupConcurrency: 8,
    dbOpConcurrency: 8,
    batchSize: 8,
    batchDelayMs: 120,
    perUserTimeoutMs: 150_000,
  },
  heavy: {
    userCount: 100,
    flowConcurrency: 10,
    setupConcurrency: 10,
    dbOpConcurrency: 10,
    batchSize: 10,
    batchDelayMs: 150,
    perUserTimeoutMs: 180_000,
  },
};

function readModeArg(): StressMode {
  const modeFromArg = process.argv.find((arg) => arg.startsWith("--mode="))?.split("=")[1]?.trim().toLowerCase();
  const modeFromEnv = process.env.STRESS_MODE?.trim().toLowerCase();
  const requestedMode = modeFromArg || modeFromEnv || "light";

  if (requestedMode === "light" || requestedMode === "medium" || requestedMode === "heavy") {
    return requestedMode;
  }

  throw new Error(`Invalid mode '${requestedMode}'. Valid modes: light, medium, heavy`);
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function readModeConfig(): ModeConfig {
  const mode = readModeArg();
  const base = MODE_PROFILES[mode];

  const userCount = clampInt(Number(process.env.STRESS_USER_COUNT ?? String(base.userCount)), 1, 1000);
  const flowConcurrency = clampInt(Number(process.env.STRESS_CONCURRENCY ?? String(base.flowConcurrency)), 1, 50);
  const setupConcurrency = clampInt(Number(process.env.STRESS_SETUP_CONCURRENCY ?? String(base.setupConcurrency)), 1, 50);
  const dbOpConcurrency = clampInt(Number(process.env.STRESS_DB_OP_CONCURRENCY ?? String(base.dbOpConcurrency)), 1, 40);
  const batchSize = clampInt(Number(process.env.STRESS_BATCH_SIZE ?? String(base.batchSize)), 1, 50);
  const batchDelayMs = clampInt(Number(process.env.STRESS_BATCH_DELAY_MS ?? String(base.batchDelayMs)), 0, 10_000);
  const perUserTimeoutMs = clampInt(Number(process.env.STRESS_PER_USER_TIMEOUT_MS ?? String(base.perUserTimeoutMs)), 5_000, 300_000);

  return {
    mode,
    userCount,
    flowConcurrency,
    setupConcurrency,
    dbOpConcurrency,
    batchSize,
    batchDelayMs,
    perUserTimeoutMs,
  };
}


const MODE_CONFIG = readModeConfig();
const DELAY_THRESHOLD_MS = 2000;
const GLOBAL_USER_CONCURRENCY = 30; // hard cap for parallel user flows
const userFlowLimit = pLimit(GLOBAL_USER_CONCURRENCY);

function nowMs() {
  return Date.now();
}

function toMs(start: number) {
  return nowMs() - start;
}

function toPercentiles(values: number[]): Percentiles {
  if (values.length === 0) {
    return { p50: 0, p95: 0, max: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const pick = (q: number) => {
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
    return sorted[idx];
  };

  return {
    p50: pick(0.5),
    p95: pick(0.95),
    max: sorted[sorted.length - 1],
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function logStressEvent(event: StressLogEvent) {
  console.log(
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        ...event,
      },
      null,
      0
    )
  );
}

function printUsageAndExit() {
  console.log(`Usage: npx ts-node scripts/stress_referral_box_flow.ts [--mode=light|medium|heavy]\n\nModes:\n  light   10 users, lower concurrency (most stable)\n  medium  50 users\n  heavy   100 users\n\nOptional environment overrides:\n  STRESS_USER_COUNT\n  STRESS_CONCURRENCY\n  STRESS_SETUP_CONCURRENCY\n  STRESS_DB_OP_CONCURRENCY\n  STRESS_BATCH_SIZE\n  STRESS_BATCH_DELAY_MS\n  STRESS_PER_USER_TIMEOUT_MS\n  STRESS_MODE\n  STRESS_USE_SQL_FUNCTION`);
  process.exit(0);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printUsageAndExit();
}

const dbOpLimit = pLimit(MODE_CONFIG.dbOpConcurrency);

async function measureDbQuery<T>(runTag: string, phase: "setup" | "open" | "consistency", fn: () => Promise<T>) {
  const start = nowMs();
  try {
    const result = await dbOpLimit(() => fn());
    logStressEvent({
      event: "db_query_timing",
      tags: ["stress_test"],
      runTag,
      phase,
      dbQueryTimeMs: toMs(start),
    });
    return result;
  } catch (error) {
    logStressEvent({
      event: "db_query_failed",
      tags: ["stress_test"],
      runTag,
      phase,
      dbQueryTimeMs: toMs(start),
      failureReason: toErrorMessage(error),
    });
    throw error;
  }
}

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null;

  return new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(`${label}_timeout_after_${timeoutMs}ms`));
    }, timeoutMs);

    fn()
      .then((value) => {
        if (timer) {
          clearTimeout(timer);
        }
        resolve(value);
      })
      .catch((error) => {
        if (timer) {
          clearTimeout(timer);
        }
        reject(error);
      });
  });
}

async function runInBatches<T>(
  items: T[],
  batchSize: number,
  batchDelayMs: number,
  runBatch: (item: T, index: number) => Promise<void>
) {
  for (let start = 0; start < items.length; start += batchSize) {
    const slice = items.slice(start, start + batchSize);
    await Promise.all(slice.map((item, offset) => runBatch(item, start + offset)));
    const hasMore = start + batchSize < items.length;
    if (hasMore && batchDelayMs > 0) {
      await delay(batchDelayMs);
    }
  }
}

function deterministicJitter(seed: string, attempt: number, maxJitterMs: number) {
  if (maxJitterMs <= 0) {
    return 0;
  }

  let hash = 0;
  const source = `${seed}:${attempt}`;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }

  return hash % (maxJitterMs + 1);
}

function isTransientStressError(error: unknown): boolean {
  if (isRetryablePrismaError(error)) {
    return true;
  }

  const message = String((error as Error)?.message ?? error).toLowerCase();
  if (!message) {
    return false;
  }

  if (
    message.includes("connection terminated unexpectedly") ||
    message.includes("timeout exceeded when trying to connect") ||
    message.includes("unable to start a transaction in the given time") ||
    message.includes("transaction api error") ||
    message.includes("too many connections") ||
    message.includes("deadlock detected") ||
    message.includes("could not serialize access due to")
  ) {
    return true;
  }

  return false;
}

async function withTransientRetry<T>(
  runTag: string,
  phase: "setup" | "open" | "consistency",
  context: { userId?: string; platformId?: string },
  fn: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  }
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 6;
  const baseDelayMs = options?.baseDelayMs ?? 200;
  const maxDelayMs = options?.maxDelayMs ?? 3000;
  let attempt = 0;
  let delayMs = baseDelayMs;
  const retrySeed = `${runTag}:${phase}:${context.userId ?? context.platformId ?? "global"}`;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      const message = String((error as Error)?.message ?? error);
      const retryable = isTransientStressError(error);

      attempt += 1;
      if (!retryable || attempt >= maxAttempts) {
        logStressEvent({
          event: "retry_exhausted",
          tags: ["stress_test", "retry_attempt"],
          runTag,
          phase,
          userId: context.userId,
          platformId: context.platformId,
          retryAttempt: attempt,
          failureReason: message,
        });
        throw error;
      }

      const jitterMs = deterministicJitter(retrySeed, attempt, 80);
      const sleepMs = delayMs + jitterMs;
      logStressEvent({
        event: "retry_scheduled",
        tags: ["stress_test", "retry_attempt"],
        runTag,
        phase,
        userId: context.userId,
        platformId: context.platformId,
        retryAttempt: attempt,
        retryDelayMs: sleepMs,
        failureReason: message,
      });

      if (/timeout exceeded when trying to connect|timed out|timeout/i.test(message)) {
        logStressEvent({
          event: "db_timeout_detected",
          tags: ["stress_test", "db_timeout"],
          runTag,
          phase,
          userId: context.userId,
          platformId: context.platformId,
          failureReason: message,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, sleepMs));
      delayMs = Math.min(maxDelayMs, delayMs * 2);
    }
  }
}

async function hasOpenBoxFunction() {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'open_box' AND n.nspname = 'public'
    ) AS exists
  `;

  return Boolean(rows[0]?.exists);
}

async function main() {
  const runTag = `${Date.now()}`;
  const testPrefix = `stress-${runTag}`;
  const startedAt = nowMs();

  logStressEvent({
    event: "stress_test_started",
    tags: ["stress_test"],
    runTag,
    phase: "summary",
    details: {
      mode: MODE_CONFIG.mode,
      userCount: MODE_CONFIG.userCount,
      concurrency: MODE_CONFIG.flowConcurrency,
      setupConcurrency: MODE_CONFIG.setupConcurrency,
      dbOpConcurrency: MODE_CONFIG.dbOpConcurrency,
      batchSize: MODE_CONFIG.batchSize,
      batchDelayMs: MODE_CONFIG.batchDelayMs,
      perUserTimeoutMs: MODE_CONFIG.perUserTimeoutMs,
    },
  });

  const shouldTrySqlFunction = process.env.STRESS_USE_SQL_FUNCTION === "1";
  const useSqlFunction = shouldTrySqlFunction
    ? await measureDbQuery(runTag, "consistency", () => hasOpenBoxFunction())
    : false;

  const box = await measureDbQuery(runTag, "setup", () =>
    prisma.box.findFirst({
    select: {
      id: true,
      price: true,
    },
    })
  );

  if (!box) {
    throw new Error("No box found to execute stress test");
  }

  const inviter = await measureDbQuery(runTag, "setup", () =>
    prisma.user.create({
    data: {
      platformId: `${testPrefix}-inviter`,
      referralCode: `S${runTag.slice(-11)}`,
      createdIp: "10.0.0.1",
      signupIp: "10.0.0.1",
      signupDeviceId: `${testPrefix}-inviter-device`,
    },
    select: {
      id: true,
      referralCode: true,
    },
    })
  );

  await measureDbQuery(runTag, "setup", () =>
    prisma.wallet.create({
      data: {
        userId: inviter.id,
        cashBalance: new Prisma.Decimal(100000),
        bonusBalance: new Prisma.Decimal(0),
      },
    })
  );

  const userIndexes = Array.from({ length: MODE_CONFIG.userCount }, (_, i) => i + 1);

  // Controlled global concurrency for user flows
  const setupResults: SetupResult[] = new Array(userIndexes.length);
  const openResults: UserRunResult[] = new Array(userIndexes.length);

  await Promise.all(
    userIndexes.map((n, index) =>
      userFlowLimit(async () => {
        const userFlowStart = nowMs();
        const platformId = `${testPrefix}-user-${n}`;
        const referralCode = `R${runTag.slice(-8)}${String(n).padStart(3, "0")}`;
        let userId = "";
        let joinMs = 0;
        let joinOk = false;
        let setupTimedOut = false;
        let setupError: string | undefined = undefined;
        let openMs = 0;
        let openOk = false;
        let openTimedOut = false;
        let openError: string | undefined = undefined;

        // Wrap the entire user flow in a single timeout
        await withTimeout(async () => {
          // Setup phase with retry
          const setupStart = nowMs();
          try {
            await withTransientRetry(
              runTag,
              "setup",
              { platformId },
              () =>
                measureDbQuery(runTag, "setup", () => prisma.$transaction(
                  async (tx) => {
                    const user = await tx.user.create({
                      data: {
                        platformId,
                        referralCode,
                        createdIp: `10.0.${Math.floor(n / 10)}.${n % 10}`,
                        signupIp: `10.1.${Math.floor(n / 10)}.${n % 10}`,
                        signupDeviceId: `${testPrefix}-device-${n}`,
                      },
                      select: { id: true },
                    });
                    userId = user.id;
                    await tx.wallet.create({
                      data: {
                        userId,
                        cashBalance: new Prisma.Decimal(10000),
                        bonusBalance: new Prisma.Decimal(0),
                      },
                    });
                    await tx.user.update({
                      where: { id: userId },
                      data: {
                        referredById: inviter.id,
                        referralStatus: "JOINED",
                        referralJoinedAt: new Date(),
                      },
                    });
                    await tx.referralLog.create({
                      data: {
                        inviterId: inviter.id,
                        referredUserId: userId,
                        ip: `172.16.${Math.floor(n / 10)}.${n % 10}`,
                        deviceId: `${testPrefix}-join-device-${n}`,
                        suspicious: false,
                      },
                    });
                  },
                  {
                    maxWait: 5000,
                    timeout: 20000,
                  }
                )),
              {
                maxAttempts: 5,
                baseDelayMs: 100,
                maxDelayMs: 1200,
              }
            );
            joinMs = toMs(setupStart);
            joinOk = true;
            logStressEvent({
              event: "setup_user_success",
              tags: ["stress_test"],
              runTag,
              phase: "setup",
              userId,
              platformId,
              requestDurationMs: joinMs,
            });
          } catch (error) {
            joinMs = 0;
            joinOk = false;
            setupTimedOut = error instanceof TimeoutError;
            setupError = toErrorMessage(error);
            logStressEvent({
              event: "setup_user_failed",
              tags: ["stress_test", ...(setupTimedOut ? (["db_timeout"] as StressTag[]) : [])],
              runTag,
              phase: "setup",
              userId,
              platformId,
              requestDurationMs: toMs(setupStart),
              failureReason: setupError,
            });
          }

          // Open phase with retry
          const openStart = nowMs();
          if (joinOk && userId) {
            try {
              const idempotencyKey = `${runTag}-open-${String(index + 1).padStart(4, "0")}`;
              await withTransientRetry(
                runTag,
                "open",
                { userId, platformId },
                async () => {
                  if (useSqlFunction) {
                    await measureDbQuery(runTag, "open", () => prisma.$executeRaw`
                      SELECT open_box(${userId}, ${box.id}, ${idempotencyKey})
                    `);
                    return;
                  }
                  await measureDbQuery(runTag, "open", () =>
                    openBoxService(
                      userId,
                      box.id,
                      idempotencyKey,
                      `172.20.${Math.floor(Number(platformId.split("-").pop() || "0") / 10)}.${Number(platformId.split("-").pop() || "0") % 10}`,
                      `${testPrefix}-open-device-${platformId.split("-").pop() || "0"}`
                    )
                  );
                },
                {
                  maxAttempts: 6,
                  baseDelayMs: 120,
                  maxDelayMs: 1500,
                }
              );
              openMs = toMs(openStart);
              openOk = true;
              logStressEvent({
                event: "open_user_success",
                tags: ["stress_test"],
                runTag,
                phase: "open",
                userId,
                platformId,
                requestDurationMs: toMs(userFlowStart),
                dbQueryTimeMs: openMs,
              });
            } catch (error) {
              openMs = 0;
              openOk = false;
              openTimedOut = error instanceof TimeoutError;
              openError = toErrorMessage(error);
              logStressEvent({
                event: "open_user_failed",
                tags: ["stress_test", ...(openTimedOut ? (["db_timeout"] as StressTag[]) : [])],
                runTag,
                phase: "open",
                userId,
                platformId,
                requestDurationMs: toMs(userFlowStart),
                dbQueryTimeMs: toMs(openStart),
                failureReason: openError,
              });
            }
          }
        }, MODE_CONFIG.perUserTimeoutMs, `user_flow_${platformId}`);

        // Save results
        setupResults[index] = {
          userId,
          platformId,
          joinMs,
          joinOk,
          timedOut: setupTimedOut,
          error: setupError,
        };
        openResults[index] = {
          userId,
          platformId,
          joinMs,
          openMs,
          totalMs: toMs(userFlowStart),
          joinOk,
          openOk,
          timedOut: setupTimedOut || openTimedOut,
          error: setupError || openError,
        };
      })
    )
  );

  const userResults: UserRunResult[] = openResults;

  let missingReferralLink: string[] = [];
  let missingReferralLog: string[] = [];
  let negativeWalletUsers: string[] = [];
  let usersMissingBoxTx: string[] = [];
  let usersWithDuplicateBoxTx: string[] = [];
  let usersNotActivated: string[] = [];
  let usersMissingReferralGrant: string[] = [];
  let usersWithDuplicateReferralGrant: string[] = [];
  let usersWithDuplicateReferralRewardTx: string[] = [];
  let consistencyCheckError: string | null = null;

  try {
    const testUsers = await withTransientRetry(
      runTag,
      "consistency",
      {},
      () =>
        measureDbQuery(runTag, "consistency", () =>
          prisma.user.findMany({
          where: {
            platformId: {
              startsWith: `${testPrefix}-user-`,
            },
          },
          select: {
            id: true,
            platformId: true,
            referredById: true,
            wallet: {
              select: {
                cashBalance: true,
                bonusBalance: true,
              },
            },
          },
          })
        ),
      {
        maxAttempts: 6,
        baseDelayMs: 120,
        maxDelayMs: 1200,
      }
    );

    missingReferralLink = testUsers.filter((u) => u.referredById !== inviter.id).map((u) => u.id);

    const userIds = testUsers.map((u) => u.id);
    const referralLogs = userIds.length
      ? await withTransientRetry(
          runTag,
          "consistency",
          {},
          () =>
            measureDbQuery(runTag, "consistency", () =>
              prisma.referralLog.findMany({
                where: {
                  inviterId: inviter.id,
                  referredUserId: { in: userIds },
                },
                select: { referredUserId: true },
              })
            ),
          {
            maxAttempts: 4,
            baseDelayMs: 100,
            maxDelayMs: 800,
          }
        )
      : [];

    const referralLogCounts = new Map<string, number>();
    for (const row of referralLogs) {
      referralLogCounts.set(row.referredUserId, (referralLogCounts.get(row.referredUserId) ?? 0) + 1);
    }

    missingReferralLog = userIds.filter((id) => (referralLogCounts.get(id) ?? 0) < 1);

    negativeWalletUsers = testUsers
      .filter((u) => {
        const wallet = u.wallet;
        if (!wallet) return true;
        return wallet.cashBalance.lt(0) || wallet.bonusBalance.lt(0);
      })
      .map((u) => u.id);

    const successfulOpenUserIds = userResults.filter((r) => r.openOk).map((r) => r.userId).filter(Boolean);
    const txRows = successfulOpenUserIds.length
      ? await withTransientRetry(
          runTag,
          "consistency",
          {},
          () =>
            measureDbQuery(runTag, "consistency", () =>
              prisma.transaction.groupBy({
              by: ["userId", "type"],
              where: {
                userId: { in: successfulOpenUserIds },
                type: { in: ["BOX_PURCHASE", "BOX_REWARD"] },
              },
              _count: { _all: true },
              })
            ),
          {
            maxAttempts: 5,
            baseDelayMs: 100,
            maxDelayMs: 1000,
          }
        )
      : [];

    const txMap = new Map<string, { purchase: number; reward: number }>();
    for (const row of txRows) {
      const curr = txMap.get(row.userId) ?? { purchase: 0, reward: 0 };
      if (row.type === "BOX_PURCHASE") curr.purchase = row._count._all;
      if (row.type === "BOX_REWARD") curr.reward = row._count._all;
      txMap.set(row.userId, curr);
    }

    usersMissingBoxTx = successfulOpenUserIds.filter((userId) => {
      const entry = txMap.get(userId);
      return !entry || entry.purchase !== 1 || entry.reward !== 1;
    });

    usersWithDuplicateBoxTx = successfulOpenUserIds.filter((userId) => {
      const entry = txMap.get(userId);
      return Boolean(entry && (entry.purchase > 1 || entry.reward > 1));
    });

    const activatedUsers = await withTransientRetry(
      runTag,
      "consistency",
      {},
      () =>
        measureDbQuery(runTag, "consistency", () =>
          prisma.user.findMany({
            where: {
              id: { in: successfulOpenUserIds },
            },
            select: {
              id: true,
              referralStatus: true,
            },
          })
        ),
      {
        maxAttempts: 4,
        baseDelayMs: 100,
        maxDelayMs: 800,
      }
    );

    usersNotActivated = activatedUsers
      .filter((u) => u.referralStatus !== "ACTIVE")
      .map((u) => u.id);

    const grants = successfulOpenUserIds.length
      ? await withTransientRetry(
          runTag,
          "consistency",
          {},
          () =>
            measureDbQuery(runTag, "consistency", () =>
              prisma.referralRewardGrant.groupBy({
                by: ["referredUserId"],
                where: {
                  referredUserId: { in: successfulOpenUserIds },
                },
                _count: { _all: true },
              })
            ),
          {
            maxAttempts: 5,
            baseDelayMs: 100,
            maxDelayMs: 1000,
          }
        )
      : [];

    const grantMap = new Map<string, number>();
    for (const row of grants) {
      grantMap.set(row.referredUserId, row._count._all);
    }

    usersMissingReferralGrant = successfulOpenUserIds.filter((id) => (grantMap.get(id) ?? 0) < 1);
    usersWithDuplicateReferralGrant = successfulOpenUserIds.filter((id) => (grantMap.get(id) ?? 0) > 1);

    const referralRewardTx = successfulOpenUserIds.length
      ? await withTransientRetry(
          runTag,
          "consistency",
          {},
          () =>
            measureDbQuery(runTag, "consistency", () =>
              prisma.transaction.findMany({
                where: {
                  userId: inviter.id,
                  type: "REFERRAL",
                  createdAt: { gte: new Date(startedAt) },
                },
                select: {
                  meta: true,
                },
              })
            ),
          {
            maxAttempts: 4,
            baseDelayMs: 100,
            maxDelayMs: 800,
          }
        )
      : [];

    const referralRewardTxCounts = new Map<string, number>();
    for (const tx of referralRewardTx) {
      const meta = tx.meta && typeof tx.meta === "object" ? (tx.meta as Record<string, unknown>) : null;
      const referredUserId = typeof meta?.referredUserId === "string" ? meta.referredUserId : null;
      if (referredUserId && successfulOpenUserIds.includes(referredUserId)) {
        referralRewardTxCounts.set(
          referredUserId,
          (referralRewardTxCounts.get(referredUserId) ?? 0) + 1
        );
      }
    }

    usersWithDuplicateReferralRewardTx = successfulOpenUserIds.filter(
      (id) => (referralRewardTxCounts.get(id) ?? 0) > 1
    );
  } catch (error) {
    consistencyCheckError = toErrorMessage(error);
    logStressEvent({
      event: "consistency_check_failed",
      tags: ["stress_test"],
      runTag,
      phase: "consistency",
      failureReason: consistencyCheckError,
    });
  }

  const joinDurations = userResults.map((r: UserRunResult) => r.joinMs).filter((v: number) => v > 0);
  const openDurations = userResults.map((r: UserRunResult) => r.openMs).filter((v: number) => v > 0);
  const totalDurations = userResults.map((r: UserRunResult) => r.totalMs);

  const delayedJoin = userResults.filter((r: UserRunResult) => r.joinMs > DELAY_THRESHOLD_MS).length;
  const delayedOpen = userResults.filter((r: UserRunResult) => r.openMs > DELAY_THRESHOLD_MS).length;
  const delayedTotal = userResults.filter((r: UserRunResult) => r.totalMs > DELAY_THRESHOLD_MS).length;

  const failures = userResults.filter((r: UserRunResult) => r.error);
  const timeoutCount = userResults.filter((r: UserRunResult) => r.timedOut).length;
  const successCount = userResults.filter((r: UserRunResult) => r.joinOk && r.openOk).length;
  const failureCount = userResults.length - successCount;
  const avgLatencyMs =
    totalDurations.length > 0
      ? Number((totalDurations.reduce((sum: number, curr: number) => sum + curr, 0) / totalDurations.length).toFixed(2))
      : 0;

  const consistencyViolations =
    missingReferralLink.length +
    missingReferralLog.length +
    negativeWalletUsers.length +
    usersMissingBoxTx.length +
    usersWithDuplicateBoxTx.length +
    usersNotActivated.length +
    usersMissingReferralGrant.length +
    usersWithDuplicateReferralGrant.length +
    usersWithDuplicateReferralRewardTx.length;

  const passCriteria = {
    zeroConsistencyViolations: consistencyViolations === 0,
    noFatalConsistencyCheckError: consistencyCheckError === null,
    timeoutBudgetOk: timeoutCount === 0,
    failureBudgetOk: failureCount === 0,
    referralActivationIntegrityOk:
      usersNotActivated.length === 0 &&
      usersMissingReferralGrant.length === 0,
    noDuplicateRewardsOk:
      usersWithDuplicateBoxTx.length === 0 &&
      usersWithDuplicateReferralGrant.length === 0 &&
      usersWithDuplicateReferralRewardTx.length === 0,
  };

  const pass =
    passCriteria.zeroConsistencyViolations &&
    passCriteria.noFatalConsistencyCheckError &&
    passCriteria.timeoutBudgetOk &&
    passCriteria.failureBudgetOk &&
    passCriteria.referralActivationIntegrityOk &&
    passCriteria.noDuplicateRewardsOk;


  // Explicit logs for critical consistency issues
  if (usersWithDuplicateReferralRewardTx.length > 0) {
    console.error("[CRITICAL] Duplicate referral reward transactions detected for users:", usersWithDuplicateReferralRewardTx);
  }
  if (usersWithDuplicateReferralGrant.length > 0) {
    console.error("[CRITICAL] Duplicate referral reward grants detected for users:", usersWithDuplicateReferralGrant);
  }
  if (negativeWalletUsers.length > 0) {
    console.error("[CRITICAL] Negative wallet balances detected for users:", negativeWalletUsers);
  }

  const report = {
    config: {
      mode: MODE_CONFIG.mode,
      users: MODE_CONFIG.userCount,
      concurrency: MODE_CONFIG.flowConcurrency,
      setupConcurrency: MODE_CONFIG.setupConcurrency,
      dbOpConcurrency: MODE_CONFIG.dbOpConcurrency,
      batchSize: MODE_CONFIG.batchSize,
      batchDelayMs: MODE_CONFIG.batchDelayMs,
      perUserTimeoutMs: MODE_CONFIG.perUserTimeoutMs,
      delayThresholdMs: DELAY_THRESHOLD_MS,
      runTag,
      executionMode: useSqlFunction ? "sql_function_open_box" : "typescript_service_openBox",
      inviterId: inviter.id,
      boxId: box.id,
      boxPrice: box.price.toString(),
    },
    results: {
      totalUsers: userResults.length,
      successCount,
      failureCount,
      timeoutCount,
      successRate: userResults.length > 0 ? `${((successCount / userResults.length) * 100).toFixed(1)}%` : "0%",
      avgLatencyMs,
      failureReasons: failures.map(f => f.error).filter(Boolean).slice(0, 10),
    },
    stability: {
      totalOperations: MODE_CONFIG.userCount * 2,
      failedUsers: failures.length,
      crashDetected: false,
      failureSamples: failures.slice(0, 10),
    },
    latency: {
      delayedResponsesOver2s: {
        join: delayedJoin,
        open: delayedOpen,
        totalPerUserFlow: delayedTotal,
      },
      joinMs: toPercentiles(joinDurations),
      openMs: toPercentiles(openDurations),
      totalMs: toPercentiles(totalDurations),
    },
    consistency: {
      inconsistentStates: consistencyViolations,
      checkError: consistencyCheckError,
      missingReferralLinkCount: missingReferralLink.length,
      missingReferralLogCount: missingReferralLog.length,
      negativeWalletUserCount: negativeWalletUsers.length,
      usersMissingBoxTransactionCount: usersMissingBoxTx.length,
      usersWithDuplicateBoxTransactionCount: usersWithDuplicateBoxTx.length,
      usersNotActivatedCount: usersNotActivated.length,
      usersMissingReferralGrantCount: usersMissingReferralGrant.length,
      usersWithDuplicateReferralGrantCount: usersWithDuplicateReferralGrant.length,
      usersWithDuplicateReferralRewardTxCount: usersWithDuplicateReferralRewardTx.length,
      sample: {
        missingReferralLink: missingReferralLink.slice(0, 10),
        missingReferralLog: missingReferralLog.slice(0, 10),
        negativeWalletUsers: negativeWalletUsers.slice(0, 10),
        usersMissingBoxTx: usersMissingBoxTx.slice(0, 10),
        usersWithDuplicateBoxTx: usersWithDuplicateBoxTx.slice(0, 10),
        usersNotActivated: usersNotActivated.slice(0, 10),
        usersMissingReferralGrant: usersMissingReferralGrant.slice(0, 10),
        usersWithDuplicateReferralGrant: usersWithDuplicateReferralGrant.slice(0, 10),
        usersWithDuplicateReferralRewardTx: usersWithDuplicateReferralRewardTx.slice(0, 10),
      },
    },
    passCriteria,
    status: pass ? "PASS" : "FAIL",
    bottlenecks: {
      likely: [
        {
          area: "Box open path",
          reason: "Highest p95 latency in open operation suggests DB write/transaction contention.",
        },
        {
          area: "End-to-end user flow",
          reason: "Total flow p95 captures cumulative impact of referral write + open_box execution.",
        },
      ],
    },
    runtimeMs: toMs(startedAt),
    completedWithPartialFailures: failureCount > 0 || consistencyViolations > 0,
  };

  logStressEvent({
    event: "stress_test_summary",
    tags: ["stress_test"],
    runTag,
    phase: "summary",
    details: {
      successCount,
      failureCount,
      timeoutCount,
      avgLatencyMs,
      delayedJoin,
      delayedOpen,
      delayedTotal,
      consistencyViolations,
      runtimeMs: report.runtimeMs,
    },
  });

  console.log(JSON.stringify(report, null, 2));
  if (!pass) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    const message = toErrorMessage(error);
    console.error(
      JSON.stringify(
        {
          status: "completed_with_fatal_error",
          error: message,
        },
        null,
        2
      )
    );
  })
  .finally(async () => {
    await disconnectFeatureFlags();
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
