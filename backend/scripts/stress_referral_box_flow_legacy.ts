import { Prisma } from "@prisma/client";
import { prisma } from "../src/config/db";
import { v4 as uuidv4 } from "uuid";

const USER_COUNT = 100;
const CONCURRENCY = 20;
const DELAY_THRESHOLD_MS = 2000;

type RunRow = {
  userId: string;
  platformId: string;
  joinMs: number;
  openMs: number;
  totalMs: number;
  ok: boolean;
  error?: string;
};

type Percentiles = {
  p50: number;
  p95: number;
  max: number;
};

type CreatedUser = {
  id: string;
};

type BoxRow = {
  id: string;
  price: Prisma.Decimal;
};

function nowMs() {
  return Date.now();
}

function elapsedMs(start: number) {
  return nowMs() - start;
}

function percentiles(values: number[]): Percentiles {
  if (!values.length) {
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

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, idx: number) => Promise<R>) {
  const out = new Array<R>(items.length);
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const idx = cursor;
      cursor += 1;
      if (idx >= items.length) {
        return;
      }
      out[idx] = await worker(items[idx], idx);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runWorker()));
  return out;
}

async function main() {
  const started = nowMs();
  const runTag = `${Date.now()}`;
  const prefix = `legacy-stress-${runTag}`;

  const boxes = await prisma.$queryRaw<BoxRow[]>`
    SELECT id, price
    FROM "Box"
    ORDER BY id ASC
    LIMIT 1
  `;

  const box = boxes[0];
  if (!box) {
    throw new Error("No box found");
  }

  const inviterRows = await prisma.$queryRaw<CreatedUser[]>`
    INSERT INTO "User" ("id", "platformId", "referralCode", "createdIp", "signupIp", "signupDeviceId")
    VALUES (
      ${uuidv4()},
      ${`${prefix}-inviter`},
      ${`INV${runTag.slice(-9)}`},
      '10.10.0.1',
      '10.10.0.1',
      ${`${prefix}-inviter-device`}
    )
    RETURNING id
  `;

  const inviterId = inviterRows[0]?.id;
  if (!inviterId) {
    throw new Error("Failed to create inviter user");
  }

  await prisma.$executeRaw`
    INSERT INTO "Wallet" ("id", "userId", "cashBalance", "bonusBalance")
    VALUES (${uuidv4()}, ${inviterId}, 100000, 0)
  `;

  const userIndexes = Array.from({ length: USER_COUNT }, (_, i) => i + 1);
  const rewardAmount = box.price.mul(0.92);

  const rows = await mapWithConcurrency(userIndexes, CONCURRENCY, async (n): Promise<RunRow> => {
    const startUser = nowMs();
    let userId = "";
    const createdUserId = uuidv4();
    const platformId = `${prefix}-u-${n}`;
    let joinMs = 0;
    let openMs = 0;

    try {
      const users = await prisma.$queryRaw<CreatedUser[]>`
        INSERT INTO "User" ("id", "platformId", "referralCode", "createdIp", "signupIp", "signupDeviceId")
        VALUES (
          ${createdUserId},
          ${platformId},
          ${`RC${runTag.slice(-6)}${String(n).padStart(3, "0")}`},
          ${`10.20.${Math.floor(n / 10)}.${n % 10}`},
          ${`10.21.${Math.floor(n / 10)}.${n % 10}`},
          ${`${prefix}-device-${n}`}
        )
        RETURNING id
      `;

      userId = users[0]?.id ?? "";
      if (!userId) {
        throw new Error("User create returned empty id");
      }

      await prisma.$executeRaw`
        INSERT INTO "Wallet" ("id", "userId", "cashBalance", "bonusBalance")
        VALUES (${uuidv4()}, ${userId}, 10000, 0)
      `;

      const startJoin = nowMs();
      await prisma.$transaction(async (tx) => {
        const updated = await tx.$executeRaw`
          UPDATE "User"
          SET "referredById" = ${inviterId}
          WHERE id = ${userId} AND "referredById" IS NULL
        `;

        if (updated !== 1) {
          throw new Error("Referral join update failed");
        }

        await tx.$executeRaw`
          INSERT INTO "ReferralLog" ("referrerId", "referredId", "ip", "deviceId", "suspicious")
          VALUES (
            ${inviterId},
            ${userId},
            ${`172.16.${Math.floor(n / 10)}.${n % 10}`},
            ${`${prefix}-join-${n}`},
            false
          )
        `;
      });
      joinMs = elapsedMs(startJoin);

      const startOpen = nowMs();
      await prisma.$transaction(async (tx) => {
        const walletRows = await tx.$queryRaw<{ cashBalance: Prisma.Decimal; bonusBalance: Prisma.Decimal }[]>`
          SELECT "cashBalance", "bonusBalance"
          FROM "Wallet"
          WHERE "userId" = ${userId}
          FOR UPDATE
        `;

        const wallet = walletRows[0];
        if (!wallet) {
          throw new Error("Wallet not found");
        }

        const beforeTotal = wallet.cashBalance.plus(wallet.bonusBalance);
        if (beforeTotal.lt(box.price)) {
          throw new Error("Insufficient balance");
        }

        const afterPurchase = beforeTotal.minus(box.price);
        const afterReward = afterPurchase.plus(rewardAmount);

        await tx.$executeRaw`
          UPDATE "Wallet"
          SET "cashBalance" = ${afterReward}, "bonusBalance" = 0
          WHERE "userId" = ${userId}
        `;

        await tx.$executeRaw`
          INSERT INTO "Transaction" ("userId", "boxId", "type", "amount", "balanceBefore", "balanceAfter")
          VALUES (${userId}, ${box.id}, 'BOX_PURCHASE', ${box.price.neg()}, ${beforeTotal}, ${afterPurchase})
        `;

        await tx.$executeRaw`
          INSERT INTO "Transaction" ("userId", "boxId", "type", "amount", "balanceBefore", "balanceAfter")
          VALUES (${userId}, ${box.id}, 'BOX_REWARD', ${rewardAmount}, ${afterPurchase}, ${afterReward})
        `;

        await tx.$executeRaw`
          INSERT INTO "BoxOpen" ("id", "userId", "boxId", "rewardAmount")
          VALUES (${uuidv4()}, ${userId}, ${box.id}, ${rewardAmount})
        `;

        await tx.$executeRaw`
          UPDATE "User"
          SET "paidBoxesOpened" = COALESCE("paidBoxesOpened", 0) + 1,
              "totalPlaysCount" = COALESCE("totalPlaysCount", 0) + 1,
              "lastPlayTimestamp" = NOW()
          WHERE id = ${userId}
        `;
      });
      openMs = elapsedMs(startOpen);

      return {
        userId,
        platformId,
        joinMs,
        openMs,
        totalMs: elapsedMs(startUser),
        ok: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        userId,
        platformId,
        joinMs,
        openMs,
        totalMs: elapsedMs(startUser),
        ok: false,
        error: message,
      };
    }
  });

  const missingReferralLinkRows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT u.id
    FROM "User" u
    WHERE u."platformId" LIKE ${`${prefix}-u-%`}
      AND u."referredById" IS DISTINCT FROM ${inviterId}
  `;

  const missingReferralLogRows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT u.id
    FROM "User" u
    WHERE u."platformId" LIKE ${`${prefix}-u-%`}
      AND NOT EXISTS (
        SELECT 1
        FROM "ReferralLog" rl
        WHERE rl."referrerId" = ${inviterId}
          AND rl."referredId" = u.id
      )
  `;

  const negativeWalletRows = await prisma.$queryRaw<{ userId: string }[]>`
    SELECT w."userId"
    FROM "Wallet" w
    JOIN "User" u ON u.id = w."userId"
    WHERE u."platformId" LIKE ${`${prefix}-u-%`}
      AND (w."cashBalance" < 0 OR w."bonusBalance" < 0)
  `;

  const missingOpenTxRows = await prisma.$queryRaw<{ userId: string }[]>`
    SELECT u.id AS "userId"
    FROM "User" u
    WHERE u."platformId" LIKE ${`${prefix}-u-%`}
      AND (
        (SELECT COUNT(1) FROM "Transaction" t WHERE t."userId" = u.id AND t.type = 'BOX_PURCHASE') < 1
        OR
        (SELECT COUNT(1) FROM "Transaction" t WHERE t."userId" = u.id AND t.type = 'BOX_REWARD') < 1
      )
  `;

  const failures = rows.filter((r) => !r.ok);
  const joinMsAll = rows.map((r) => r.joinMs).filter((v) => v > 0);
  const openMsAll = rows.map((r) => r.openMs).filter((v) => v > 0);
  const totalMsAll = rows.map((r) => r.totalMs);

  const report = {
    config: {
      users: USER_COUNT,
      concurrency: CONCURRENCY,
      delayThresholdMs: DELAY_THRESHOLD_MS,
      runTag,
      executionMode: "legacy_raw_sql",
      inviterId,
      boxId: box.id,
      boxPrice: box.price.toString(),
      rewardAmount: rewardAmount.toString(),
    },
    stability: {
      noCrashes: failures.length === 0,
      failedUsers: failures.length,
      failureSamples: failures.slice(0, 10),
    },
    latency: {
      delayedResponsesOver2s: {
        join: rows.filter((r) => r.joinMs > DELAY_THRESHOLD_MS).length,
        open: rows.filter((r) => r.openMs > DELAY_THRESHOLD_MS).length,
        totalFlow: rows.filter((r) => r.totalMs > DELAY_THRESHOLD_MS).length,
      },
      joinMs: percentiles(joinMsAll),
      openMs: percentiles(openMsAll),
      totalMs: percentiles(totalMsAll),
    },
    consistency: {
      inconsistentStates:
        missingReferralLinkRows.length +
        missingReferralLogRows.length +
        negativeWalletRows.length +
        missingOpenTxRows.length,
      missingReferralLinkCount: missingReferralLinkRows.length,
      missingReferralLogCount: missingReferralLogRows.length,
      negativeWalletCount: negativeWalletRows.length,
      usersMissingOpenTransactionsCount: missingOpenTxRows.length,
      samples: {
        missingReferralLink: missingReferralLinkRows.slice(0, 10),
        missingReferralLog: missingReferralLogRows.slice(0, 10),
        negativeWallet: negativeWalletRows.slice(0, 10),
        missingOpenTransactions: missingOpenTxRows.slice(0, 10),
      },
    },
    runtimeMs: elapsedMs(started),
  };

  console.log(JSON.stringify(report, null, 2));
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
