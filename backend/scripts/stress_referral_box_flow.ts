import { Prisma } from "@prisma/client";
import { prisma } from "../src/config/db";
import { v4 as uuidv4 } from "uuid";
import { openBox as openBoxService } from "../src/modules/game/game.service";

type UserRunResult = {
  userId: string;
  platformId: string;
  joinMs: number;
  openMs: number;
  totalMs: number;
  joinOk: boolean;
  openOk: boolean;
  error?: string;
};

type Percentiles = {
  p50: number;
  p95: number;
  max: number;
};

const USER_COUNT = 100;
const CONCURRENCY = 100;
const DELAY_THRESHOLD_MS = 2000;

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

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function runOne() {
    while (true) {
      const idx = cursor;
      cursor += 1;
      if (idx >= items.length) {
        return;
      }
      results[idx] = await worker(items[idx], idx);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runOne()));
  return results;
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

  const useSqlFunction = false;

  const box = await prisma.box.findFirst({
    select: {
      id: true,
      price: true,
    },
  });

  if (!box) {
    throw new Error("No box found to execute stress test");
  }

  const inviter = await prisma.user.create({
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
  });

  await prisma.wallet.create({
    data: {
      userId: inviter.id,
      cashBalance: new Prisma.Decimal(100000),
      bonusBalance: new Prisma.Decimal(0),
    },
  });

  const userIndexes = Array.from({ length: USER_COUNT }, (_, i) => i + 1);

  const userResults = await mapWithConcurrency(userIndexes, CONCURRENCY, async (n): Promise<UserRunResult> => {
    const userStart = nowMs();
    const platformId = `${testPrefix}-user-${n}`;
    const referralCode = `R${runTag.slice(-8)}${String(n).padStart(3, "0")}`;

    let userId = "";
    let joinMs = 0;
    let openMs = 0;

    try {
      const joinStart = nowMs();
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            platformId,
            referralCode,
            createdIp: `10.0.${Math.floor(n / 10)}.${n % 10}`,
            signupIp: `10.1.${Math.floor(n / 10)}.${n % 10}`,
            signupDeviceId: `${testPrefix}-device-${n}`,
          },
          select: {
            id: true,
          },
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
      });
      joinMs = toMs(joinStart);

      const openStart = nowMs();
      const idempotencyKey = uuidv4();
      if (useSqlFunction) {
        await prisma.$executeRaw`
          SELECT open_box(${userId}, ${box.id}, ${idempotencyKey})
        `;
      } else {
        await openBoxService(
          userId,
          box.id,
          idempotencyKey,
          `172.20.${Math.floor(n / 10)}.${n % 10}`,
          `${testPrefix}-open-device-${n}`
        );
      }
      openMs = toMs(openStart);

      return {
        userId,
        platformId,
        joinMs,
        openMs,
        totalMs: toMs(userStart),
        joinOk: true,
        openOk: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        userId,
        platformId,
        joinMs,
        openMs,
        totalMs: toMs(userStart),
        joinOk: joinMs > 0,
        openOk: openMs > 0,
        error: message,
      };
    }
  });

  const testUsers = await prisma.user.findMany({
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
  });

  const missingReferralLink = testUsers.filter((u) => u.referredById !== inviter.id).map((u) => u.id);

  const missingReferralLog: string[] = [];
  for (const user of testUsers) {
    const row = await prisma.referralLog.findUnique({
      where: {
        inviterId_referredUserId: {
          inviterId: inviter.id,
          referredUserId: user.id,
        },
      },
      select: { id: true },
    });

    if (!row) {
      missingReferralLog.push(user.id);
    }
  }

  const negativeWalletUsers = testUsers
    .filter((u) => {
      const wallet = u.wallet;
      if (!wallet) return true;
      return wallet.cashBalance.lt(0) || wallet.bonusBalance.lt(0);
    })
    .map((u) => u.id);

  const successfulOpenUserIds = userResults.filter((r) => r.openOk).map((r) => r.userId).filter(Boolean);
  const txRows = successfulOpenUserIds.length
    ? await prisma.transaction.groupBy({
        by: ["userId", "type"],
        where: {
          userId: { in: successfulOpenUserIds },
          type: { in: ["BOX_PURCHASE", "BOX_REWARD"] },
        },
        _count: { _all: true },
      })
    : [];

  const txMap = new Map<string, { purchase: number; reward: number }>();
  for (const row of txRows) {
    const curr = txMap.get(row.userId) ?? { purchase: 0, reward: 0 };
    if (row.type === "BOX_PURCHASE") curr.purchase = row._count._all;
    if (row.type === "BOX_REWARD") curr.reward = row._count._all;
    txMap.set(row.userId, curr);
  }

  const usersMissingBoxTx = successfulOpenUserIds.filter((userId) => {
    const entry = txMap.get(userId);
    return !entry || entry.purchase < 1 || entry.reward < 1;
  });

  const joinDurations = userResults.map((r) => r.joinMs).filter((v) => v > 0);
  const openDurations = userResults.map((r) => r.openMs).filter((v) => v > 0);
  const totalDurations = userResults.map((r) => r.totalMs);

  const delayedJoin = userResults.filter((r) => r.joinMs > DELAY_THRESHOLD_MS).length;
  const delayedOpen = userResults.filter((r) => r.openMs > DELAY_THRESHOLD_MS).length;
  const delayedTotal = userResults.filter((r) => r.totalMs > DELAY_THRESHOLD_MS).length;

  const failures = userResults.filter((r) => r.error);
  const consistencyViolations =
    missingReferralLink.length +
    missingReferralLog.length +
    negativeWalletUsers.length +
    usersMissingBoxTx.length;

  const report = {
    config: {
      users: USER_COUNT,
      concurrency: CONCURRENCY,
      delayThresholdMs: DELAY_THRESHOLD_MS,
      runTag,
      executionMode: useSqlFunction ? "sql_function_open_box" : "typescript_service_openBox",
      inviterId: inviter.id,
      boxId: box.id,
      boxPrice: box.price.toString(),
    },
    stability: {
      totalOperations: USER_COUNT * 2,
      failedUsers: failures.length,
      crashDetected: failures.length > 0,
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
      missingReferralLinkCount: missingReferralLink.length,
      missingReferralLogCount: missingReferralLog.length,
      negativeWalletUserCount: negativeWalletUsers.length,
      usersMissingBoxTransactionCount: usersMissingBoxTx.length,
      sample: {
        missingReferralLink: missingReferralLink.slice(0, 10),
        missingReferralLog: missingReferralLog.slice(0, 10),
        negativeWalletUsers: negativeWalletUsers.slice(0, 10),
        usersMissingBoxTx: usersMissingBoxTx.slice(0, 10),
      },
    },
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
  };

  console.log(JSON.stringify(report, null, 2));

  if (failures.length > 0 || consistencyViolations > 0) {
    throw new Error(
      `Stress test failed: failedUsers=${failures.length}, consistencyViolations=${consistencyViolations}`
    );
  }
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ error: message }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
