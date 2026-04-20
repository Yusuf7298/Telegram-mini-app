import { Prisma } from "@prisma/client";
import crypto from "crypto";
import { prisma } from "../src/config/db";
import { openBox } from "../src/modules/game/game.service";
import { env } from "../src/config/env";

type SimulationResult = {
  duplicateOccurred: boolean;
  grantCount: number;
  referralTransactionCount: number;
  walletDelta: string;
  expectedSingleReward: string;
  requestSummary: {
    total: number;
    fulfilled: number;
    rejected: number;
  };
};

function decimalToNumber(value: Prisma.Decimal): number {
  return Number(value.toString());
}

async function holdReferralGrantTableLock(seconds: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('LOCK TABLE "ReferralRewardGrant" IN ACCESS EXCLUSIVE MODE');
    await tx.$executeRawUnsafe(`SELECT pg_sleep(${seconds})`);
  });
}

async function ensureGameConfig() {
  await prisma.gameConfig.upsert({
    where: { id: "global" },
    create: { id: "global" },
    update: {},
  });
}

async function ensureSystemStats() {
  await prisma.systemStats.upsert({
    where: { id: "global" },
    create: { id: "global" },
    update: {},
  });
}

async function ensureBox() {
  const existing = await prisma.box.findFirst({ orderBy: { price: "asc" } });
  if (existing) {
    return existing;
  }

  return prisma.box.create({
    data: {
      name: "Concurrency Simulation Box",
      price: new Prisma.Decimal(100),
    },
  });
}

async function createSimulationUsers(runTag: string) {
  const inviter = await prisma.user.create({
    data: {
      platformId: `sim-inviter-${runTag}`,
      referralCode: `SIM${runTag.slice(0, 6).toUpperCase()}A`,
      createdIp: "127.0.0.1",
      signupIp: "127.0.0.1",
      signupDeviceId: "sim-device-inviter",
      wallet: {
        create: {
          cashBalance: new Prisma.Decimal(0),
          bonusBalance: new Prisma.Decimal(0),
        },
      },
    },
    include: { wallet: true },
  });

  const referred = await prisma.user.create({
    data: {
      platformId: `sim-referred-${runTag}`,
      referralCode: `SIM${runTag.slice(0, 6).toUpperCase()}B`,
      referredById: inviter.id,
      referralStatus: "JOINED",
      referralJoinedAt: new Date(Date.now() - 60 * 60 * 1000),
      createdIp: "127.0.0.2",
      signupIp: "127.0.0.2",
      signupDeviceId: "sim-device-referred",
      wallet: {
        create: {
          cashBalance: new Prisma.Decimal(10000),
          bonusBalance: new Prisma.Decimal(0),
        },
      },
    },
    include: { wallet: true },
  });

  return { inviter, referred };
}

async function runSimulation(): Promise<SimulationResult> {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  if (!env.REDIS_URL) {
    throw new Error("REDIS_URL is not set");
  }

  await ensureGameConfig();
  await ensureSystemStats();

  const box = await ensureBox();
  const runTag = crypto.randomUUID().replace(/-/g, "");
  const { inviter, referred } = await createSimulationUsers(runTag);

  const config = await prisma.gameConfig.findUnique({ where: { id: "global" } });
  if (!config) {
    throw new Error("GameConfig not found");
  }

  const expectedReward = config.referralRewardAmount;
  const inviterWalletBefore = await prisma.wallet.findUnique({ where: { userId: inviter.id } });
  if (!inviterWalletBefore) {
    throw new Error("Inviter wallet not found");
  }

  // Delayed DB commit simulation: hold an exclusive lock while concurrent open-box requests begin.
  const lockPromise = holdReferralGrantTableLock(2);
  await new Promise((resolve) => setTimeout(resolve, 150));

  const baseIdem = `sim-activation-${runTag}`;
  const requestKeys = [
    `${baseIdem}-1`,
    `${baseIdem}-2`,
    `${baseIdem}-3`,
    `${baseIdem}-4`,
    `${baseIdem}-5`,
    `${baseIdem}-1`, // network retry duplicate request
  ];

  const settled = await Promise.allSettled(
    requestKeys.map((key) => openBox(referred.id, box.id, key, "127.0.0.2", "sim-device-referred"))
  );

  await lockPromise;

  const inviterWalletAfter = await prisma.wallet.findUnique({ where: { userId: inviter.id } });
  if (!inviterWalletAfter) {
    throw new Error("Inviter wallet not found after simulation");
  }

  const grants = await prisma.referralRewardGrant.findMany({
    where: { referredUserId: referred.id },
  });

  const referralTransactions = await prisma.transaction.count({
    where: {
      userId: inviter.id,
      type: "REFERRAL",
    },
  });

  const walletDeltaDecimal = inviterWalletAfter.cashBalance.minus(inviterWalletBefore.cashBalance);
  const walletDelta = decimalToNumber(walletDeltaDecimal);
  const expectedSingleReward = decimalToNumber(expectedReward);

  const duplicateGrant = grants.length > 1;
  const duplicateWalletCredit = walletDelta > expectedSingleReward;
  const duplicateReferralTransactions = referralTransactions > 1;

  return {
    duplicateOccurred: duplicateGrant || duplicateWalletCredit || duplicateReferralTransactions,
    grantCount: grants.length,
    referralTransactionCount: referralTransactions,
    walletDelta: walletDeltaDecimal.toString(),
    expectedSingleReward: expectedReward.toString(),
    requestSummary: {
      total: settled.length,
      fulfilled: settled.filter((entry) => entry.status === "fulfilled").length,
      rejected: settled.filter((entry) => entry.status === "rejected").length,
    },
  };
}

async function main() {
  try {
    const result = await runSimulation();
    const verdict = result.duplicateOccurred ? "FAIL" : "PASS";

    console.log(
      JSON.stringify(
        {
          verdict,
          checks: {
            oneRewardGrantOnly: result.grantCount === 1,
            walletIncrementOnce: result.walletDelta === result.expectedSingleReward,
            noDuplicateReferralRewardGrantEntries: result.grantCount === 1,
          },
          metrics: result,
        },
        null,
        2
      )
    );

    if (result.duplicateOccurred) {
      process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ verdict: "FAIL", error: message }, null, 2));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
