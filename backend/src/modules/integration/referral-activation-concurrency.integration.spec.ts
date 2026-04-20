// @ts-nocheck
import { Prisma } from "@prisma/client";

const idempotencyStore = new Map<string, any>();

const logger = {
  logStructuredEvent: jest.fn().mockResolvedValue(undefined),
  logError: jest.fn().mockResolvedValue(undefined),
  logJackpotSkip: jest.fn().mockResolvedValue(undefined),
};

jest.mock("../../services/logger", () => logger);

jest.mock("../../utils/lock", () => ({
  withUserLock: async (_userId: string, fn: () => Promise<unknown>) => fn(),
}));

jest.mock("../../services/withTransactionRetry", () => ({
  withTransactionRetry: async (_prisma: unknown, fn: (tx: any) => Promise<unknown>) => fn((global as any).__TX__),
}));

jest.mock("../../services/rtp.service", () => ({
  adjustRewardProbabilities: jest.fn(async () => ({ adjusted: false })),
}));

jest.mock("../../services/suspiciousActionLog.service", () => ({
  logSuspiciousAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../services/auditLog.service", () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../services/bonus.service", () => ({
  trackBonusUsage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../services/referral.service", () => ({
  logReferral: jest.fn().mockResolvedValue(undefined),
  checkReferralLimits: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../services/requestContext.service", () => ({
  getCorrelationId: jest.fn(() => "sim-correlation-id"),
}));

jest.mock("../../services/fraudDetection.service", () => ({
  recordBoxOpenAttempt: jest.fn(() => ({ isSuspicious: false })),
  recordRewardEvent: jest.fn(() => ({ isSuspicious: false })),
  recordReferralActivationForInviter: jest.fn(() => ({ isAnomalous: false, count: 1, timeframeMs: 300000 })),
  recordReferralRewardForInviter: jest.fn(() => ({ isAnomalous: false, count: 1, timeframeMs: 300000 })),
}));

jest.mock("../../services/rules.service", () => ({
  canUserPlay: jest.fn(async () => true),
  isCooldownActive: jest.fn(async () => ({ active: false, elapsedMs: 0, cooldownMs: 0 })),
  canUnlockWaitlistBonus: jest.fn(async () => false),
  isRapidOnboardingCompletion: jest.fn(async () => false),
  shouldEvaluateReferralOnPlay: jest.fn(() => false),
  canActivateReferral: jest.fn((referral: { status: string }) => referral.status === "JOINED"),
}));

jest.mock("../../services/reward.service", () => ({
  generateReward: jest.fn(() => new Prisma.Decimal(25)),
}));

jest.mock("../../services/gameConfig.service", () => ({
  getValidatedGameConfig: jest.fn(async () => ({
    id: "global",
    rtpModifier: 1,
    maxPayoutMultiplier: new Prisma.Decimal(1.2),
    minRtpModifier: new Prisma.Decimal(1),
    maxRtpModifier: new Prisma.Decimal(1.2),
    referralRewardAmount: new Prisma.Decimal(200),
    freeBoxRewardAmount: new Prisma.Decimal(200),
    minBoxReward: 10,
    maxBoxReward: 100,
    waitlistBonus: 1000,
    maxPlaysPerDay: 5,
    withdrawRiskThreshold: 70,
    waitlistRiskThreshold: 50,
    rapidOnboardingWindowMs: 10000,
    minPlayIntervalMs: 0,
    referralWindowMs: 86400000,
  })),
}));

jest.mock("../../services/idempotency.service", () => ({
  createIdempotencyKey: jest.fn(async ({ id, userId, action }: any) => {
    if (idempotencyStore.has(id)) {
      throw new Error("Idempotency key already exists");
    }

    const pending = {
      id,
      userId,
      action,
      status: "PENDING",
      response: null,
    };

    idempotencyStore.set(id, pending);
    return pending;
  }),
  checkIdempotencyKey: jest.fn(async ({ id, userId }: any) => {
    const key = idempotencyStore.get(id) || null;
    if (!key) return null;
    if (key.userId !== userId) throw new Error("Idempotency key user mismatch");
    return key;
  }),
  completeIdempotencyKey: jest.fn(async ({ id, userId, response }: any) => {
    const existing = idempotencyStore.get(id);
    if (!existing) throw new Error("Idempotency key not found");
    if (existing.userId !== userId) throw new Error("Idempotency key user mismatch");

    const normalized = response && response.success === true && Object.prototype.hasOwnProperty.call(response, "data")
      ? response
      : { success: true, data: response, error: null };

    const completed = { ...existing, status: "COMPLETED", response: normalized };
    idempotencyStore.set(id, completed);
    return normalized;
  }),
}));

jest.mock("../../config/db", () => ({
  prisma: {
    $transaction: jest.fn(async (cb: any) => cb((global as any).__TX__)),
  },
}));

import { openBox } from "../game/game.service";

function d(value: number | string) {
  return new Prisma.Decimal(value);
}

function createKnownP2002Error() {
  const err = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
  err.code = "P2002";
  err.message = "Unique constraint failed";
  return err;
}

function createTx() {
  const state = {
    referredUser: {
      id: "referred-1",
      platformId: "platform-referred-1",
      isFrozen: false,
      accountStatus: "ACTIVE",
      riskScore: 0,
      totalPlaysCount: 0,
      paidBoxesOpened: 0,
      referredById: "inviter-1",
      lastPlayTimestamp: new Date(Date.now() - 60_000),
      waitlistBonusUnlocked: false,
      waitlistBonusEligible: true,
      referralStatus: "JOINED",
      referralJoinedAt: new Date(Date.now() - 30 * 60_000),
      referralActivatedAt: null,
    },
    inviterUser: {
      id: "inviter-1",
      referralCode: "INVITER1",
      referralCount: 0,
    },
    wallets: {
      "referred-1": {
        userId: "referred-1",
        cashBalance: d(10000),
        bonusBalance: d(0),
        bonusLocked: false,
      },
      "inviter-1": {
        userId: "inviter-1",
        cashBalance: d(0),
        bonusBalance: d(0),
        bonusLocked: false,
      },
    },
    box: {
      id: "box-1",
      name: "Sim Box",
      price: d(100),
    },
    writes: {
      referralRewardGrantCreates: 0,
      inviterWalletCredits: 0,
      referralTransactions: 0,
      boxOpens: 0,
    },
    referralRewardGrant: {
      created: false,
      inFlight: false,
      rows: [] as Array<{ referrerId: string; referredUserId: string; amount: Prisma.Decimal }> ,
    },
  };

  let boxOpenSequence = 0;

  const tx = {
    user: {
      findUnique: jest.fn(async ({ where, select }: any) => {
        if (where?.id === state.referredUser.id) {
          const user = state.referredUser;
          if (!select) return { ...user };
          const result: any = {};
          for (const key of Object.keys(select)) {
            result[key] = (user as any)[key];
          }
          return result;
        }

        if (where?.id === state.inviterUser.id) {
          const inviterWallet = state.wallets[state.inviterUser.id];
          return {
            id: state.inviterUser.id,
            referralCode: state.inviterUser.referralCode,
            referralCount: state.inviterUser.referralCount,
            wallet: select?.wallet ? {
              cashBalance: inviterWallet.cashBalance,
              bonusBalance: inviterWallet.bonusBalance,
            } : undefined,
          };
        }

        return null;
      }),
      update: jest.fn(async ({ where, data, select }: any) => {
        if (where?.id !== state.referredUser.id) {
          return null;
        }

        if (data?.totalPlaysCount?.increment) {
          state.referredUser.totalPlaysCount += data.totalPlaysCount.increment;
        }
        if (data?.paidBoxesOpened?.increment) {
          state.referredUser.paidBoxesOpened += data.paidBoxesOpened.increment;
        }
        if (data?.lastPlayTimestamp) {
          state.referredUser.lastPlayTimestamp = data.lastPlayTimestamp;
        }

        if (!select) {
          return { ...state.referredUser };
        }

        const result: any = {};
        for (const key of Object.keys(select)) {
          result[key] = (state.referredUser as any)[key];
        }
        return result;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        if (where?.id === state.referredUser.id && where?.referralStatus === "JOINED") {
          if (state.referredUser.referralStatus !== "JOINED") {
            return { count: 0 };
          }

          state.referredUser.referralStatus = data.referralStatus;
          state.referredUser.referralActivatedAt = data.referralActivatedAt;
          return { count: 1 };
        }

        if (where?.id === state.referredUser.id) {
          return { count: 1 };
        }

        return { count: 0 };
      }),
    },
    wallet: {
      findUnique: jest.fn(async ({ where }: any) => {
        const wallet = state.wallets[where.userId];
        if (!wallet) return null;
        return {
          userId: wallet.userId,
          cashBalance: wallet.cashBalance,
          bonusBalance: wallet.bonusBalance,
          bonusLocked: wallet.bonusLocked,
        };
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const wallet = state.wallets[where.userId];
        if (!wallet) return { count: 0 };

        if (data.cashBalance !== undefined) {
          wallet.cashBalance = data.cashBalance;
        }
        if (data.bonusBalance !== undefined) {
          wallet.bonusBalance = data.bonusBalance;
        }
        return { count: 1 };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const wallet = state.wallets[where.userId];
        if (!wallet) {
          throw new Error("Wallet not found");
        }

        if (data.cashBalance?.increment) {
          wallet.cashBalance = wallet.cashBalance.plus(data.cashBalance.increment);
          if (where.userId === state.inviterUser.id) {
            state.writes.inviterWalletCredits += 1;
          }
        }

        if (data.bonusBalance?.increment) {
          wallet.bonusBalance = wallet.bonusBalance.plus(data.bonusBalance.increment);
        }

        if (data.bonusLocked !== undefined) {
          wallet.bonusLocked = data.bonusLocked;
        }

        return {
          userId: wallet.userId,
          cashBalance: wallet.cashBalance,
          bonusBalance: wallet.bonusBalance,
          bonusLocked: wallet.bonusLocked,
        };
      }),
    },
    box: {
      findUnique: jest.fn(async () => ({ ...state.box })),
    },
    boxOpenLog: {
      create: jest.fn(async () => ({})),
    },
    boxOpen: {
      count: jest.fn(async () => 1),
      create: jest.fn(async () => {
        boxOpenSequence += 1;
        state.writes.boxOpens += 1;
        return { id: `play-${boxOpenSequence}` };
      }),
    },
    systemStats: {
      upsert: jest.fn(async () => ({})),
    },
    gameConfig: {
      findUnique: jest.fn(async () => ({ id: "global", rtpModifier: 1 })),
    },
    referralRewardGrant: {
      findUnique: jest.fn(async ({ where }: any) => {
        const row = state.referralRewardGrant.rows.find((entry) => entry.referredUserId === where.referredUserId);
        return row ? { id: `grant-${row.referredUserId}` } : null;
      }),
      create: jest.fn(async ({ data }: any) => {
        if (!state.referralRewardGrant.inFlight && !state.referralRewardGrant.created) {
          state.referralRewardGrant.inFlight = true;
          await new Promise((resolve) => setTimeout(resolve, 80));
          state.referralRewardGrant.created = true;
          state.referralRewardGrant.inFlight = false;
          state.referralRewardGrant.rows.push({
            referrerId: data.referrerId,
            referredUserId: data.referredUserId,
            amount: data.amount,
          });
          state.writes.referralRewardGrantCreates += 1;
          return { id: "grant-1" };
        }

        throw createKnownP2002Error();
      }),
    },
    transaction: {
      create: jest.fn(async ({ data }: any) => {
        if (data.type === "REFERRAL" && data.userId === state.inviterUser.id) {
          state.writes.referralTransactions += 1;
        }
        return { id: `tx-${crypto.randomUUID?.() ?? Math.random().toString(16).slice(2)}` };
      }),
      findMany: jest.fn(async () => []),
    },
    auditLog: {
      create: jest.fn(async () => ({})),
    },
  };

  return { tx, state };
}

describe("referral activation concurrency simulation", () => {
  beforeEach(() => {
    idempotencyStore.clear();
    jest.clearAllMocks();
  });

  it("grants referral reward exactly once under 5 parallel requests + retry + delayed commit", async () => {
    const { tx, state } = createTx();
    (global as any).__TX__ = tx;

    const keys = [
      "sim-idem-1",
      "sim-idem-2",
      "sim-idem-3",
      "sim-idem-4",
      "sim-idem-5",
    ];

    const parallelResults = await Promise.allSettled(
      keys.map((key) => openBox("referred-1", "box-1", key, "127.0.0.2", "sim-device"))
    );

    const retryResult = await Promise.allSettled([
      openBox("referred-1", "box-1", "sim-idem-1", "127.0.0.2", "sim-device"),
    ]);

    const inviterWallet = state.wallets["inviter-1"];

    const fulfilled = parallelResults.filter((entry) => entry.status === "fulfilled").length;
    const rejected = parallelResults.filter((entry) => entry.status === "rejected").length;

    expect(fulfilled + rejected).toBe(5);
    expect(retryResult[0].status).toBe("fulfilled");

    expect(state.referralRewardGrant.rows.length).toBe(1);
    expect(state.writes.referralRewardGrantCreates).toBe(1);
    expect(inviterWallet.cashBalance.toString()).toBe("200");
    expect(state.writes.inviterWalletCredits).toBe(1);
    expect(state.writes.referralTransactions).toBe(1);
  });
});
