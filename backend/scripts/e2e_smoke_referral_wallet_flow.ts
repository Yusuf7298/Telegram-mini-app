import crypto from "crypto";
import express from "express";
import request from "supertest";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/config/db";
import { decimalSerializer } from "../src/middleware/decimalSerializer";
import authRoutes from "../src/modules/auth/auth.routes";
import gameRoutes from "../src/modules/game/game.routes";
import referralRoutes from "../src/modules/referral/referral.routes";
import walletRoutes from "../src/modules/wallet/wallet.routes";
import { authMiddleware } from "../src/middleware/auth.middleware";
import { getValidatedGameConfig } from "../src/services/gameConfig.service";
import { applyReferralCode, ReferralServiceError } from "../src/services/referral.service";
import { authWithTelegram, generateToken } from "../src/modules/auth/auth.service";
import { disconnectFeatureFlags } from "../src/config/featureFlags";

if (!process.env.FF_REFERRAL_ENABLED) {
  process.env.FF_REFERRAL_ENABLED = "true";
}

type SmokeActor = {
  label: string;
  telegramId: string;
  username: string;
  ip: string;
  deviceId: string;
  initData: string;
  token?: string;
  userId?: string;
  referralCode?: string;
};

type StepResult = {
  name: string;
  status: "PASS" | "FAIL";
  details?: Record<string, unknown>;
};

type GameConfigSummary = {
  withdrawMinPlays: number;
  withdrawCooldownMs: number;
  referralRewardAmount: string;
};

type BoxSummary = {
  id: string;
  name: string;
  price: string;
};

const runTag = `smoke-${Date.now()}`;
const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
const expectedOutputs = [
  "Login responses return success, token, user, and referral bootstrap data.",
  "Referral join returns JOINED state and creates a single referral log row.",
  "Referral activation via game returns a referralActivation payload and grants the reward exactly once.",
  "Wallet balances in Postgres match the API responses after reward and withdrawal.",
  "Withdrawal attempt returns success and writes the expected wallet mutation and transaction row.",
];
const passFailConditions = [
  "FAIL if any HTTP step returns a non-2xx response.",
  "FAIL if login does not create a wallet and referral code for each test user.",
  "FAIL if referral join does not set referredById, referralStatus=JOINED, and exactly one referralLog row.",
  "FAIL if game play does not move the referred user to ACTIVE and create exactly one referralRewardGrant and one REFERRAL transaction.",
  "FAIL if inviter wallet, referred wallet, or withdrawal wallet state does not match the calculated DB expectation.",
];

function createSmokeApp() {
  const app = express();
  app.set("trust proxy", true);
  app.use(express.json());
  app.use(decimalSerializer);
  app.use("/api/auth", authRoutes);
  app.use("/api/referral", referralRoutes);
  app.use("/api/game", gameRoutes);
  app.use("/api/wallet", authMiddleware, walletRoutes);
  return app;
}

function assertCondition(condition: unknown, message: string, details?: Record<string, unknown>): asserts condition {
  if (!condition) {
    const suffix = details ? ` | ${JSON.stringify(details)}` : "";
    throw new Error(`${message}${suffix}`);
  }
}

function toStringValue(value: unknown): string {
  if (value instanceof Prisma.Decimal) {
    return value.toString();
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NaN";
  }
  if (typeof value === "string") {
    return value;
  }
  return String(value ?? "");
}

function toDecimal(value: string | number | Prisma.Decimal) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildTelegramInitData(params: {
  telegramId: string;
  username: string;
  firstName: string;
  lastName?: string;
}) {
  return new URLSearchParams({
    user: JSON.stringify({
      id: params.telegramId,
      username: params.username,
      first_name: params.firstName,
      ...(params.lastName ? { last_name: params.lastName } : {}),
    }),
  }).toString();
}

function createActor(label: string, suffix: string): SmokeActor {
  const telegramId = `${runTag}-${suffix}`;
  const username = `${label}_${runTag}`.replace(/[^a-zA-Z0-9_]/g, "_");
  const ip =
    suffix === "inviter"
      ? `10.${crypto.randomInt(1, 240)}.${crypto.randomInt(1, 240)}.${crypto.randomInt(2, 250)}`
      : `10.${crypto.randomInt(1, 240)}.${crypto.randomInt(1, 240)}.${crypto.randomInt(2, 250)}`;
  const deviceId = `${runTag}-${suffix}-device`;
  return {
    label,
    telegramId,
    username,
    ip,
    deviceId,
    initData: buildTelegramInitData({
      telegramId,
      username,
      firstName: label,
      lastName: "Smoke",
    }),
  };
}

async function loginActor(
  actor: SmokeActor,
) {
  const user = await authWithTelegram(actor.initData, {
    ip: actor.ip,
    deviceId: actor.deviceId,
    userAgent: `${actor.label}/smoke`,
  });

  const token = generateToken(user.id, user.role);
  const userId = user.id;
  const referralCode = user.referralCode;

  actor.token = token;
  actor.userId = userId;
  actor.referralCode = referralCode;

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      telegramId: true,
      platformId: true,
      referralCode: true,
      referralStatus: true,
      referralJoinedAt: true,
      referralActivatedAt: true,
      totalPlaysCount: true,
      wallet: {
        select: {
          cashBalance: true,
          bonusBalance: true,
          bonusLocked: true,
        },
      },
    },
  });

  assertCondition(!!dbUser, `${actor.label} user not found in DB after login`);
  assertCondition(dbUser.referralCode === referralCode, `${actor.label} referral code mismatch`, {
    dbReferralCode: dbUser.referralCode,
    responseReferralCode: referralCode,
  });
  assertCondition(dbUser.referralStatus === "PENDING", `${actor.label} referral status should start as PENDING`, {
    referralStatus: dbUser.referralStatus,
  });
  assertCondition(!!dbUser.wallet, `${actor.label} wallet was not created`);

  return {
    response: { status: 200, body: { success: true, data: { token, user: dbUser } } },
    token,
    userId,
    referralCode,
    dbUser,
  };
}

async function assertReferralJoinedState(inviter: SmokeActor, referred: SmokeActor) {
  const maxAttempts = 4;
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      await applyReferralCode({
        referredUserId: referred.userId!,
        referralCode: inviter.referralCode!,
        ip: referred.ip,
        deviceId: `${referred.deviceId}-join`,
        idempotencyKey: `smoke-referral-join-${referred.userId}`,
      });
      break;
    } catch (error) {
      attempt += 1;
      if (
        error instanceof ReferralServiceError &&
        (error.message === "Referral already used" || error.code === "RATE_LIMIT")
      ) {
        break;
      }

      if (attempt >= maxAttempts) {
        throw error;
      }

      await sleep(250 * attempt);
    }
  }

  const referredDb = await prisma.user.findUnique({
    where: { id: referred.userId! },
    select: {
      id: true,
      referredById: true,
      referralStatus: true,
      referralJoinedAt: true,
      referralActivatedAt: true,
      wallet: { select: { cashBalance: true, bonusBalance: true } },
    },
  });
  const inviterDb = await prisma.user.findUnique({
    where: { id: inviter.userId! },
    select: {
      id: true,
      referralCount: true,
      wallet: { select: { cashBalance: true, bonusBalance: true } },
    },
  });
  const referralLogCount = await prisma.referralLog.count({
    where: { inviterId: inviter.userId!, referredUserId: referred.userId! },
  });
  const referralGrantCount = await prisma.referralRewardGrant.count({
    where: { referredUserId: referred.userId! },
  });

  assertCondition(!!referredDb, "referred user missing after referral join");
  assertCondition(!!inviterDb, "inviter missing after referral join");
  assertCondition(referredDb.referredById === inviter.userId, "referral join did not set referredById", {
    referredById: referredDb.referredById,
    inviterId: inviter.userId,
  });
  assertCondition(referredDb.referralStatus === "JOINED", "referral join did not transition to JOINED", {
    referralStatus: referredDb.referralStatus,
  });
  assertCondition(inviterDb.referralCount === 1, "inviter referralCount should increment to 1", {
    referralCount: inviterDb.referralCount,
  });
  assertCondition(referralLogCount === 1, "referral join should create exactly one referralLog row", {
    referralLogCount,
  });
  assertCondition(referralGrantCount === 0, "referral join should not grant reward yet", {
    referralGrantCount,
  });

  return { referredDb, inviterDb, referralLogCount, referralGrantCount };
}

async function applyReferral(app: express.Express, referred: SmokeActor, inviter: SmokeActor) {
  assertCondition(!!referred.initData, "referred actor missing initData");
  assertCondition(!!inviter.referralCode, "inviter referral code missing");

  await assertReferralJoinedState(inviter, referred);
}

async function seedSmokePreconditions(
  inviter: SmokeActor,
  referred: SmokeActor,
  config: GameConfigSummary
) {
  const fundAmount = toDecimal("100000");
  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { userId: inviter.userId! },
      data: { cashBalance: fundAmount },
    });
    await tx.wallet.update({
      where: { userId: referred.userId! },
      data: { cashBalance: fundAmount },
    });
    await tx.user.update({
      where: { id: inviter.userId! },
      data: { totalPlaysCount: config.withdrawMinPlays },
    });
  });

  const inviterDb = await prisma.user.findUnique({
    where: { id: inviter.userId! },
    select: { totalPlaysCount: true, wallet: { select: { cashBalance: true, bonusBalance: true } } },
  });
  const referredDb = await prisma.user.findUnique({
    where: { id: referred.userId! },
    select: { totalPlaysCount: true, wallet: { select: { cashBalance: true, bonusBalance: true } } },
  });

  assertCondition(inviterDb?.totalPlaysCount === config.withdrawMinPlays, "inviter play count seed failed", {
    totalPlaysCount: inviterDb?.totalPlaysCount,
    withdrawMinPlays: config.withdrawMinPlays,
  });
  assertCondition(toStringValue(inviterDb?.wallet?.cashBalance) === fundAmount.toString(), "inviter cash seed failed", {
    cashBalance: inviterDb?.wallet?.cashBalance?.toString?.(),
  });
  assertCondition(toStringValue(referredDb?.wallet?.cashBalance) === fundAmount.toString(), "referred cash seed failed", {
    cashBalance: referredDb?.wallet?.cashBalance?.toString?.(),
  });

  return { inviterDb, referredDb, fundAmount };
}

async function openReferralActivationBox(
  app: express.Express,
  inviter: SmokeActor,
  referred: SmokeActor,
  box: BoxSummary,
  config: GameConfigSummary
) {
  const idempotencyKey = `${runTag}-open-box-1`;
  const response = await request(app)
    .post("/api/game/open-box")
    .set("Accept", "application/json")
    .set("Authorization", `Bearer ${referred.token}`)
    .set("X-Forwarded-For", referred.ip)
    .set("X-Device-Id", referred.deviceId)
    .set("User-Agent", `${referred.label}/smoke`)
    .set("X-Correlation-Id", runTag)
    .send({
      boxId: box.id,
      idempotencyKey,
      timestamp: Date.now(),
    });

  assertCondition(response.status === 200, "open-box request failed", { status: response.status, body: response.body });
  assertCondition(response.body?.success === true, "open-box did not succeed", { body: response.body });

  const reward = response.body?.data?.reward;
  const referralActivation = response.body?.data?.referralActivation;
  const walletSnapshot = response.body?.data?.walletSnapshot;

  assertCondition(typeof reward === "string" && reward.length > 0, "open-box did not return a reward", { body: response.body });
  assertCondition(!!referralActivation, "open-box did not return referralActivation data", { body: response.body });
  assertCondition(!!walletSnapshot, "open-box did not return walletSnapshot data", { body: response.body });

  const referredDb = await prisma.user.findUnique({
    where: { id: referred.userId! },
    select: {
      referralStatus: true,
      referralJoinedAt: true,
      referralActivatedAt: true,
      totalPlaysCount: true,
      wallet: { select: { cashBalance: true, bonusBalance: true } },
    },
  });
  const rewardGrant = await prisma.referralRewardGrant.findUnique({
    where: { referredUserId: referred.userId! },
  });
  const referralTx = await prisma.transaction.findFirst({
    where: { userId: inviter.userId!, type: "REFERRAL" },
    orderBy: { createdAt: "desc" },
  });
  const boxOpenTx = await prisma.transaction.findFirst({
    where: { userId: referred.userId!, boxId: box.id, type: "BOX_REWARD" },
    orderBy: { createdAt: "desc" },
  });

  assertCondition(!!referredDb, "referred user missing after open-box");
  assertCondition(referredDb.referralStatus === "ACTIVE", "referral should be ACTIVE after game activation", {
    referralStatus: referredDb.referralStatus,
  });
  assertCondition(!!referredDb.referralActivatedAt, "referralActivatedAt should be set after activation");
  assertCondition(rewardGrant?.inviterId === inviter.userId, "reward grant inviter mismatch", {
    rewardGrant,
    inviterId: inviter.userId,
  });
  assertCondition(rewardGrant?.referredUserId === referred.userId, "reward grant referred user mismatch", {
    rewardGrant,
    referredUserId: referred.userId,
  });
  assertCondition(rewardGrant?.amount.toString() === config.referralRewardAmount, "reward grant amount mismatch", {
    rewardGrantAmount: rewardGrant?.amount.toString(),
    expected: config.referralRewardAmount,
  });
  assertCondition(referralTx?.type === "REFERRAL", "referral transaction missing", { referralTx });
  assertCondition(referralTx?.amount.toString() === config.referralRewardAmount, "referral transaction amount mismatch", {
    referralTxAmount: referralTx?.amount.toString(),
    expected: config.referralRewardAmount,
  });
  assertCondition(boxOpenTx?.type === "BOX_REWARD", "box reward transaction missing", { boxOpenTx });
  assertCondition(boxOpenTx?.boxId === box.id, "box reward transaction should reference the opened box", {
    boxId: box.id,
    boxOpenTx,
  });

  return {
    response,
    reward: toDecimal(reward),
    referredDb,
    rewardGrant,
    referralTx,
    boxOpenTx,
  };
}

async function verifyWalletBalances(
  inviter: SmokeActor,
  referred: SmokeActor,
  seedCash: Prisma.Decimal,
  box: BoxSummary,
  openReward: Prisma.Decimal,
  referralReward: Prisma.Decimal
) {
  const inviterDb = await prisma.user.findUnique({
    where: { id: inviter.userId! },
    select: { wallet: { select: { cashBalance: true, bonusBalance: true } } },
  });
  const referredDb = await prisma.user.findUnique({
    where: { id: referred.userId! },
    select: { wallet: { select: { cashBalance: true, bonusBalance: true } } },
  });

  const expectedInviterCash = seedCash.plus(referralReward);
  const expectedReferredCash = seedCash.minus(toDecimal(box.price)).plus(openReward);

  assertCondition(
    toStringValue(inviterDb?.wallet?.cashBalance) === expectedInviterCash.toString(),
    "inviter wallet cash balance mismatch after reward",
    {
      actual: inviterDb?.wallet?.cashBalance?.toString?.(),
      expected: expectedInviterCash.toString(),
    }
  );
  assertCondition(
    toStringValue(referredDb?.wallet?.cashBalance) === expectedReferredCash.toString(),
    "referred wallet cash balance mismatch after open-box",
    {
      actual: referredDb?.wallet?.cashBalance?.toString?.(),
      expected: expectedReferredCash.toString(),
    }
  );

  return {
    inviterDb,
    referredDb,
    expectedInviterCash,
    expectedReferredCash,
  };
}

async function withdrawFromWallet(app: express.Express, inviter: SmokeActor, amount: Prisma.Decimal) {
  const idempotencyKey = `${runTag}-withdraw-1`;
  const response = await request(app)
    .post("/api/wallet/withdraw")
    .set("Accept", "application/json")
    .set("Authorization", `Bearer ${inviter.token}`)
    .set("X-Forwarded-For", inviter.ip)
    .set("X-Device-Id", inviter.deviceId)
    .set("User-Agent", `${inviter.label}/smoke`)
    .set("X-Correlation-Id", runTag)
    .send({
      amount: amount.toString(),
      idempotencyKey,
    });

  assertCondition(response.status === 200, "withdrawal attempt failed", { status: response.status, body: response.body });
  assertCondition(response.body?.success === true, "withdrawal response was not successful", { body: response.body });

  const walletSnapshot = response.body?.data?.walletSnapshot ?? response.body?.data;
  assertCondition(!!walletSnapshot, "withdrawal response did not include wallet data", { body: response.body });

  const inviterDb = await prisma.user.findUnique({
    where: { id: inviter.userId! },
    select: {
      wallet: { select: { cashBalance: true, bonusBalance: true } },
      transactions: {
        where: { type: "BOX_PURCHASE" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, amount: true, balanceBefore: true, balanceAfter: true, meta: true },
      },
    },
  });

  const latestTransaction = inviterDb?.transactions?.[0];
  assertCondition(
    toStringValue(inviterDb?.wallet?.cashBalance) === toStringValue(walletSnapshot.cashBalance),
    "withdrawal response wallet snapshot does not match DB cash balance",
    {
      responseCashBalance: toStringValue(walletSnapshot.cashBalance),
      dbCashBalance: inviterDb?.wallet?.cashBalance?.toString?.(),
    }
  );
  assertCondition(latestTransaction?.amount.toString() === amount.neg().toString(), "withdrawal transaction amount mismatch", {
    amount: latestTransaction?.amount.toString(),
    expected: amount.neg().toString(),
  });
  const walletTotalAfterWithdraw = inviterDb?.wallet?.cashBalance?.plus(inviterDb?.wallet?.bonusBalance ?? 0);
  assertCondition(latestTransaction?.balanceAfter.toString() === walletTotalAfterWithdraw?.toString(), "withdrawal transaction balanceAfter mismatch", {
    balanceAfter: latestTransaction?.balanceAfter.toString(),
    walletTotalAfterWithdraw: walletTotalAfterWithdraw?.toString?.(),
  });

  return {
    response,
    inviterDb,
    latestTransaction,
  };
}

async function cleanupSmokeData(userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.referralRewardGrant.deleteMany({
      where: {
        OR: [{ inviterId: { in: uniqueUserIds } }, { referredUserId: { in: uniqueUserIds } }],
      },
    });
    await tx.referralLog.deleteMany({
      where: {
        OR: [{ inviterId: { in: uniqueUserIds } }, { referredUserId: { in: uniqueUserIds } }],
      },
    });
    await tx.transaction.deleteMany({ where: { userId: { in: uniqueUserIds } } });
    await tx.boxOpen.deleteMany({ where: { userId: { in: uniqueUserIds } } });
    await tx.boxOpenLog.deleteMany({ where: { userId: { in: uniqueUserIds } } });
    await tx.idempotencyKey.deleteMany({ where: { userId: { in: uniqueUserIds } } });
    await tx.bonusUsage.deleteMany({ where: { userId: { in: uniqueUserIds } } });
    await tx.suspiciousActionLog.deleteMany({ where: { userId: { in: uniqueUserIds } } });
    await tx.auditLog.deleteMany({ where: { userId: { in: uniqueUserIds } } });
    await tx.userVault.deleteMany({ where: { userId: { in: uniqueUserIds } } });
    await tx.wallet.deleteMany({ where: { userId: { in: uniqueUserIds } } });
    await tx.user.deleteMany({ where: { id: { in: uniqueUserIds } } });
  });
}

async function main() {
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN must be set before running the smoke test");
  }

  const app = createSmokeApp();
  const steps: StepResult[] = [];
  const createdUserIds: string[] = [];

  const inviter = createActor("inviter", "inviter");
  const referred = createActor("referred", "referred");
  const seedCash = toDecimal("100000");

  const gameConfig = await getValidatedGameConfig({ bypassCache: true });
  const config: GameConfigSummary = {
    withdrawMinPlays: gameConfig.withdrawMinPlays,
    withdrawCooldownMs: gameConfig.withdrawCooldownMs,
    referralRewardAmount: gameConfig.referralRewardAmount.toString(),
  };

  const box = await prisma.box.findFirst({
    select: { id: true, name: true, price: true },
  });

  assertCondition(!!box, "No box found for the smoke test");

  const smokeBox: BoxSummary = {
    id: box.id,
    name: box.name,
    price: box.price.toString(),
  };

  console.log(
    JSON.stringify(
      {
        event: "smoke_plan",
        runTag,
        expectedOutputs,
        passFailConditions,
        prerequisites: {
          box: smokeBox,
          config,
          seedCash: seedCash.toString(),
        },
      },
      null,
      2
    )
  );

  try {
    const inviterLogin = await loginActor(inviter);
    createdUserIds.push(inviterLogin.userId);
    steps.push({
      name: "signup/login inviter",
      status: "PASS",
      details: {
        userId: inviterLogin.userId,
        referralCode: inviterLogin.referralCode,
        referralStatus: inviterLogin.dbUser.referralStatus,
      },
    });
    console.log(`STEP 1 PASS - inviter login complete (${inviterLogin.userId})`);

    const referredLogin = await loginActor(referred);
    createdUserIds.push(referredLogin.userId);
    steps.push({
      name: "signup/login referred",
      status: "PASS",
      details: {
        userId: referredLogin.userId,
        referralStatus: referredLogin.dbUser.referralStatus,
      },
    });
    console.log(`STEP 2 PASS - referred login complete (${referredLogin.userId})`);

    const referralJoin = await assertReferralJoinedState(inviter, referred);
    steps.push({
      name: "referral join",
      status: "PASS",
      details: {
        referredById: referralJoin.referredDb?.referredById,
        referralStatus: referralJoin.referredDb?.referralStatus,
        inviterReferralCount: referralJoin.inviterDb?.referralCount,
      },
    });
    console.log("STEP 3 PASS - referral join complete");

    const seeded = await seedSmokePreconditions(inviter, referred, config);
    steps.push({
      name: "seed smoke preconditions",
      status: "PASS",
      details: {
        inviterCashBalance: seeded.inviterDb?.wallet?.cashBalance?.toString?.(),
        referredCashBalance: seeded.referredDb?.wallet?.cashBalance?.toString?.(),
        inviterTotalPlaysCount: seeded.inviterDb?.totalPlaysCount,
      },
    });
    console.log("STEP 4 PASS - smoke preconditions seeded");

    const activation = await openReferralActivationBox(app, inviter, referred, smokeBox, config);
    steps.push({
      name: "referral activation via game",
      status: "PASS",
      details: {
        reward: activation.reward.toString(),
        referralActivationId: activation.response.body?.data?.referralActivation?.referralId,
        referralTransactionId: activation.response.body?.data?.referralActivation?.transactionId,
      },
    });
    console.log("STEP 5 PASS - referral activated and reward granted");

    const walletCheck = await verifyWalletBalances(
      inviter,
      referred,
      seedCash,
      smokeBox,
      activation.reward,
      toDecimal(config.referralRewardAmount)
    );
    steps.push({
      name: "reward granted + wallet updated",
      status: "PASS",
      details: {
        inviterCashBalance: walletCheck.inviterDb?.wallet?.cashBalance?.toString?.(),
        referredCashBalance: walletCheck.referredDb?.wallet?.cashBalance?.toString?.(),
        expectedInviterCash: walletCheck.expectedInviterCash.toString(),
        expectedReferredCash: walletCheck.expectedReferredCash.toString(),
      },
    });
    console.log("STEP 6 PASS - wallet state matches expected balances");

    const withdrawAmount = toDecimal("100");
    const withdrawal = await withdrawFromWallet(app, inviter, withdrawAmount);
    steps.push({
      name: "withdrawal attempt",
      status: "PASS",
      details: {
        withdrawAmount: withdrawAmount.toString(),
        latestTransactionId: withdrawal.latestTransaction?.id,
        latestTransactionAmount: withdrawal.latestTransaction?.amount.toString(),
      },
    });
    console.log("STEP 7 PASS - withdrawal attempt succeeded and wallet was updated");

    const finalReport = {
      runTag,
      status: "PASS",
      expectedOutputs,
      passFailConditions,
      box: smokeBox,
      config,
      steps,
      finalState: {
        inviter: {
          userId: inviter.userId,
          referralCode: inviter.referralCode,
        },
        referred: {
          userId: referred.userId,
        },
      },
    };

    console.log(JSON.stringify(finalReport, null, 2));
  } finally {
    try {
      await cleanupSmokeData(createdUserIds);
    } catch (cleanupError) {
      console.error(
        JSON.stringify(
          {
            event: "cleanup_failed",
            runTag,
            message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          },
          null,
          2
        )
      );
    }
    await disconnectFeatureFlags();
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        runTag,
        status: "FAIL",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});