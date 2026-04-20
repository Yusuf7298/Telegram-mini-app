// @ts-nocheck
import { Prisma } from "@prisma/client";

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
  getCorrelationId: jest.fn(() => "idem-test-correlation-id"),
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
  canUserWithdraw: jest.fn(async () => ({ allowed: true })),
  canUseReferral: jest.fn(async () => true),
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
    withdrawMinPlays: 5,
    withdrawCooldownMs: 60000,
    withdrawRiskThreshold: 70,
    maxReferralsPerIpPerDay: 5,
    waitlistRiskThreshold: 50,
    rapidOnboardingWindowMs: 10000,
    minPlayIntervalMs: 0,
    referralWindowMs: 86400000,
  })),
}));

const idempotencyState = new Map<string, any>();

jest.mock("../../services/idempotency.service", () => ({
  createIdempotencyKey: jest.fn(async ({ id, userId, action }: any) => {
    if (idempotencyState.has(id)) {
      throw new Error("Idempotency key already exists");
    }

    const entry = { id, userId, action, status: "PENDING", response: null, createdAt: new Date() };
    idempotencyState.set(id, entry);
    return entry;
  }),
  checkIdempotencyKey: jest.fn(async ({
    id,
    userId,
    waitForCompletionMs = 0,
    pollIntervalMs = 10,
    pendingStaleAfterMs = 5000,
    recoverPending,
  }: any) => {
    const startedAt = Date.now();
    let recoveryAttempted = false;

    while (true) {
      const entry = idempotencyState.get(id) || null;
      if (!entry) return null;
      if (entry.userId !== userId) throw new Error("Idempotency key user mismatch");
      if (entry.status !== "PENDING") return entry;

      if (!waitForCompletionMs) {
        return entry;
      }

      const ageMs = Date.now() - new Date(entry.createdAt).getTime();
      if (!recoveryAttempted && recoverPending && ageMs >= pendingStaleAfterMs) {
        recoveryAttempted = true;
        const recovered = await recoverPending({ id, userId, key: entry });
        if (recovered) {
          const normalized = recovered && recovered.success === true
            ? recovered
            : { success: true, data: recovered, error: null };
          const completed = { ...entry, status: "COMPLETED", response: normalized };
          idempotencyState.set(id, completed);
          return completed;
        }
      }

      if (Date.now() - startedAt >= waitForCompletionMs) {
        return entry;
      }

      await new Promise((resolve) => setTimeout(resolve, Math.max(1, pollIntervalMs)));
    }
  }),
  completeIdempotencyKey: jest.fn(async ({ id, userId, response }: any) => {
    const entry = idempotencyState.get(id);
    if (!entry) throw new Error("Idempotency key not found");
    if (entry.userId !== userId) throw new Error("Idempotency key user mismatch");
    const normalized = response && response.success === true && Object.prototype.hasOwnProperty.call(response, "data")
      ? response
      : { success: true, data: response, error: null };

    idempotencyState.set(id, { ...entry, status: "COMPLETED", response: normalized });
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

function createTx() {
  const state = {
    user: {
      id: "user-1",
      platformId: "platform-1",
      isFrozen: false,
      accountStatus: "ACTIVE",
      riskScore: 0,
      totalPlaysCount: 0,
      paidBoxesOpened: 0,
      referredById: "ref-1",
      lastPlayTimestamp: new Date(Date.now() - 10 * 60 * 1000),
      waitlistBonusUnlocked: false,
      waitlistBonusEligible: true,
      referralStatus: "JOINED",
      referralJoinedAt: new Date(Date.now() - 60 * 60 * 1000),
      referralActivatedAt: null,
    },
    inviter: {
      id: "ref-1",
      referralCode: "REF-1",
      referralCount: 0,
      wallet: {
        cashBalance: d(1000),
        bonusBalance: d(0),
      },
    },
    wallet: {
      userId: "user-1",
      cashBalance: d(1000),
      bonusBalance: d(0),
      bonusLocked: false,
    },
    box: {
      id: "box-1",
      price: d(100),
      rewardTable: [],
    },
    referralGrantRows: [] as Array<{ referrerId: string; referredUserId: string; amount: Prisma.Decimal }>,
    writes: {
      inviterCredits: 0,
      referralTransactions: 0,
      boxOpenCreates: 0,
    },
    boxRewardTransactions: [] as Array<{ idempotencyKey: string | null; amount: Prisma.Decimal; createdAt: Date }>,
    failBoxOpenCreateOnce: false,
    slowBoxOpenCreateMs: 0,
  };

  const tx = {
    box: {
      findUnique: jest.fn(async () => ({ id: state.box.id, price: state.box.price, rewardTable: state.box.rewardTable })),
    },
    wallet: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.userId === state.user.id) {
          return { ...state.wallet };
        }

        if (where.userId === state.inviter.id) {
          return {
            userId: state.inviter.id,
            cashBalance: state.inviter.wallet.cashBalance,
            bonusBalance: state.inviter.wallet.bonusBalance,
            bonusLocked: false,
          };
        }

        return null;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        if (where.userId === state.inviter.id && data.cashBalance?.increment) {
          state.inviter.wallet.cashBalance = state.inviter.wallet.cashBalance.plus(data.cashBalance.increment);
          state.writes.inviterCredits += 1;
          return { count: 1 };
        }

        return { count: 1 };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        if (where.userId === state.user.id && data.cashBalance?.increment) {
          state.wallet.cashBalance = state.wallet.cashBalance.plus(data.cashBalance.increment);
          return { ...state.wallet };
        }

        if (where.userId === state.inviter.id && data.cashBalance?.increment) {
          state.inviter.wallet.cashBalance = state.inviter.wallet.cashBalance.plus(data.cashBalance.increment);
          state.writes.inviterCredits += 1;
          return {
            userId: state.inviter.id,
            cashBalance: state.inviter.wallet.cashBalance,
            bonusBalance: state.inviter.wallet.bonusBalance,
            bonusLocked: false,
          };
        }

        if (where.userId === state.wallet.userId && data.cashBalance?.increment) {
          state.wallet.cashBalance = state.wallet.cashBalance.plus(data.cashBalance.increment);
          return { ...state.wallet };
        }

        return null;
      }),
    },
    user: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.id === state.user.id) {
          return { ...state.user };
        }

        if (where.id === state.inviter.id) {
          return { id: state.inviter.id, referralCode: state.inviter.referralCode, referralCount: state.inviter.referralCount, wallet: state.inviter.wallet };
        }

        return null;
      }),
      update: jest.fn(async ({ where, data, select }: any) => {
        if (where.id === state.user.id && data?.totalPlaysCount?.increment) {
          state.user.totalPlaysCount += data.totalPlaysCount.increment;
        }
        if (where.id === state.user.id && data?.paidBoxesOpened?.increment) {
          state.user.paidBoxesOpened += data.paidBoxesOpened.increment;
        }
        if (where.id === state.user.id && data?.lastPlayTimestamp) {
          state.user.lastPlayTimestamp = data.lastPlayTimestamp;
        }

        if (!select) {
          return { ...state.user };
        }

        const output: any = {};
        for (const key of Object.keys(select)) {
          output[key] = (state.user as any)[key];
        }
        return output;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        if (where.id === state.user.id && where.referralStatus === "JOINED") {
          if (state.user.referralStatus !== "JOINED") {
            return { count: 0 };
          }

          state.user.referralStatus = data.referralStatus;
          state.user.referralActivatedAt = data.referralActivatedAt;
          return { count: 1 };
        }

        return { count: 0 };
      }),
    },
    referralRewardGrant: {
      findUnique: jest.fn(async ({ where }: any) => {
        const grant = state.referralGrantRows.find((row) => row.referredUserId === where.referredUserId);
        return grant ? { id: `grant-${grant.referredUserId}` } : null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const existing = state.referralGrantRows.find((row) => row.referredUserId === data.referredUserId);
        if (existing) {
          const err = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
          err.code = "P2002";
          throw err;
        }

        state.referralGrantRows.push({
          referrerId: data.referrerId,
          referredUserId: data.referredUserId,
          amount: data.amount,
        });

        return { id: `grant-${data.referredUserId}` };
      }),
    },
    boxOpen: {
      count: jest.fn(async () => 1),
      create: jest.fn(async () => {
        state.writes.boxOpenCreates += 1;
        if (state.slowBoxOpenCreateMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, state.slowBoxOpenCreateMs));
        }
        if (state.failBoxOpenCreateOnce) {
          state.failBoxOpenCreateOnce = false;
          throw new Error("Simulated transient failure");
        }
        return { id: `play-${state.writes.boxOpenCreates}` };
      }),
    },
    boxOpenLog: {
      create: jest.fn(async () => ({})),
    },
    transaction: {
      create: jest.fn(async ({ data }: any) => {
        if (data.type === "REFERRAL" && data.userId === state.inviter.id) {
          state.writes.referralTransactions += 1;
        }
        if (data.type === "BOX_REWARD" && data.userId === state.user.id) {
          state.boxRewardTransactions.push({
            idempotencyKey: data.meta?.idempotencyKey ?? null,
            amount: data.amount,
            createdAt: new Date(),
          });
        }
        return { id: `tx-${state.writes.referralTransactions}` };
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        const idempotencyKey = where?.meta?.equals;
        if (where?.type === "BOX_REWARD" && typeof idempotencyKey === "string") {
          const matched = [...state.boxRewardTransactions]
            .reverse()
            .find((row) => row.idempotencyKey === idempotencyKey);

          if (!matched) {
            return null;
          }

          return {
            amount: matched.amount,
            createdAt: matched.createdAt,
          };
        }

        return { createdAt: new Date(Date.now() - 60_000) };
      }),
      findMany: jest.fn(async () => []),
    },
    systemStats: {
      upsert: jest.fn(async () => ({})),
    },
    gameConfig: {
      findUnique: jest.fn(async () => ({ id: "global", rtpModifier: 1 })),
    },
    auditLog: {
      create: jest.fn(async () => ({})),
    },
  };

  return { tx, state };
}

describe("idempotency protection", () => {
  beforeEach(() => {
    idempotencyState.clear();
    jest.clearAllMocks();
  });

  it("returns the same response for the same open-box idempotency key and does not duplicate rewards", async () => {
    const { tx, state } = createTx();
    (global as any).__TX__ = tx;

    const first = await openBox("user-1", "box-1", "idem-open-1", "127.0.0.1", "device-1");
    const second = await openBox("user-1", "box-1", "idem-open-1", "127.0.0.1", "device-1");

    expect(first).toEqual(second);
    expect(state.referralGrantRows.length).toBe(1);
    expect(state.writes.inviterCredits).toBe(1);
    expect(state.inviter.wallet.cashBalance.toString()).toBe("1200");
  });

  it("does not duplicate referral activation when the same play is retried manually", async () => {
    const { tx, state } = createTx();
    (global as any).__TX__ = tx;

    await openBox("user-1", "box-1", "idem-referral-1", "127.0.0.1", "device-1");
    await openBox("user-1", "box-1", "idem-referral-2", "127.0.0.1", "device-1");

    expect(state.referralGrantRows.length).toBe(1);
    expect(state.writes.inviterCredits).toBe(1);
    expect(state.user.referralStatus).toBe("ACTIVE");
    expect(state.inviter.wallet.cashBalance.toString()).toBe("1200");
  });

  it("keeps wallet consistent across a failed request retry with the same idempotency key", async () => {
    const { tx, state } = createTx();
    state.failBoxOpenCreateOnce = true;
    (global as any).__TX__ = tx;

    await expect(openBox("user-1", "box-1", "idem-failed-1", "127.0.0.1", "device-1")).rejects.toThrow("Simulated transient failure");

    const second = await openBox("user-1", "box-1", "idem-failed-1", "127.0.0.1", "device-1");

    expect(second).toBeTruthy();
    const matchedRewards = state.boxRewardTransactions.filter((row) => row.idempotencyKey === "idem-failed-1");
    expect(matchedRewards).toHaveLength(1);
    expect(state.writes.inviterCredits).toBe(0);
    expect(state.inviter.wallet.cashBalance.toString()).toBe("1000");
  });

  it("recovers retry during pending state and returns a consistent single result", async () => {
    const { tx, state } = createTx();
    state.slowBoxOpenCreateMs = 120;
    (global as any).__TX__ = tx;

    const key = "idem-pending-retry-1";
    const firstPromise = openBox("user-1", "box-1", key, "127.0.0.1", "device-1");
    await new Promise((resolve) => setTimeout(resolve, 20));
    const secondPromise = openBox("user-1", "box-1", key, "127.0.0.1", "device-1");

    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(first).toEqual(second);
    expect(state.referralGrantRows.length).toBe(1);
    expect(state.writes.inviterCredits).toBe(1);
    const matchedRewards = state.boxRewardTransactions.filter((row) => row.idempotencyKey === key);
    expect(matchedRewards).toHaveLength(1);
  });
});