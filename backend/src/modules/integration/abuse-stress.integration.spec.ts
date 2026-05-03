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

jest.mock("../../services/reward.service", () => ({
  generateReward: jest.fn(() => new Prisma.Decimal(25)),
}));

jest.mock("../../services/rules.service", () => ({
  canUserPlay: jest.fn(async () => true),
  isCooldownActive: jest.fn(async () => ({ active: false, elapsedMs: 0, cooldownMs: 0 })),
  canUnlockWaitlistBonus: jest.fn(async () => false),
  isRapidOnboardingCompletion: jest.fn(async () => false),
  shouldEvaluateReferralOnPlay: jest.fn(() => true),
  canUserWithdraw: jest.fn(async () => ({ allowed: true })),
  canActivateReferral: jest.fn((referral: { status: string }) => referral.status === "JOINED"),
  canUseReferral: jest.fn(async () => true),
}));

jest.mock("../../services/suspiciousActionLog.service", () => ({
  logSuspiciousAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../services/alert.service", () => ({
  AlertService: {
    failedTelegramAuth: jest.fn(),
  },
}));

jest.mock("../../config/db", () => ({
  prisma: {
    $transaction: jest.fn(async (cb: any) => cb((global as any).__TX__)),
  },
}));

const idempotencyStore = new Map<string, any>();
const replayCounts = new Map<string, number>();

jest.mock("../../services/idempotency.service", () => ({
  createIdempotencyKey: jest.fn(async ({ id, userId, action, tx }: any) => {
    const existing = idempotencyStore.get(id);
    if (existing) {
      throw new Error("Idempotency key already exists");
    }

    const pending = {
      id,
      userId,
      action,
      status: "PENDING",
      response: null,
      tx,
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

    await new Promise((resolve) => setTimeout(resolve, 15));

    const normalized = response && response.success === true && Object.prototype.hasOwnProperty.call(response, "data")
      ? response
      : { success: true, data: response, error: null };

    const completed = { ...existing, status: "COMPLETED", response: normalized };
    idempotencyStore.set(id, completed);
    return normalized;
  }),
}));

jest.mock("../../services/fraudDetection.service", () => ({
  recordBoxOpenAttempt: jest.fn(async () => ({ isSuspicious: false })),
  recordRewardEvent: jest.fn(async () => ({ isSuspicious: false })),
  recordWithdrawAttempt: jest.fn(async () => ({ isSuspicious: false })),
  recordReferralActivationForInviter: jest.fn(async () => ({ isAnomalous: false, count: 1, timeframeMs: 300000 })),
  recordReferralRewardForInviter: jest.fn(async () => ({ isAnomalous: false, count: 1, timeframeMs: 300000 })),
}));

jest.mock("../../config/redis", () => ({
  redis: {
    incr: jest.fn(async (key: string) => {
      const nextCount = (replayCounts.get(key) || 0) + 1;
      replayCounts.set(key, nextCount);
      return nextCount;
    }),
    expire: jest.fn().mockResolvedValue(1),
    status: "ready",
  },
}));

import { openBox } from "../game/game.service";
import { withdrawWallet } from "../wallet/wallet.service";
import { replayProtectionMiddleware } from "../../middleware/replayProtection.middleware";

function d(value: number | string) {
  return new Prisma.Decimal(value);
}

function createTx(initialCash = 1000, initialBonus = 0) {
  let walletLocked = false;
  const waitQueue: Array<() => void> = [];

  const acquireWalletLock = async () => {
    if (walletLocked) {
      await new Promise<void>((resolve) => waitQueue.push(resolve));
    }
    walletLocked = true;
  };

  const releaseWalletLock = () => {
    walletLocked = false;
    const next = waitQueue.shift();
    if (next) next();
  };

  const state = {
    wallet: {
      userId: "user-1",
      cashBalance: d(initialCash),
      bonusBalance: d(initialBonus),
      bonusLocked: false,
    },
    user: {
      id: "user-1",
      platformId: "platform-1",
      isFrozen: false,
      accountStatus: "ACTIVE",
      riskScore: 0,
      totalPlaysCount: 10,
      referredById: null,
      lastPlayTimestamp: new Date(Date.now() - 5 * 60 * 1000),
    },
    writes: {
      walletUpdateMany: 0,
      walletUpdate: 0,
      transactionCreate: 0,
      boxOpenCreate: 0,
      userUpdate: 0,
    },
    reward: d(25),
    box: {
      id: "box-1",
      name: "Starter Box",
      price: d(100),
    },
  };

  const tx = {
    $executeRaw: jest.fn(async () => {
      await acquireWalletLock();
      return 1;
    }),
    user: {
      findUnique: jest.fn(async () => ({
        id: state.user.id,
        platformId: state.user.platformId,
        isFrozen: state.user.isFrozen,
        accountStatus: state.user.accountStatus,
        riskScore: state.user.riskScore,
        totalPlaysCount: state.user.totalPlaysCount,
        referredById: state.user.referredById,
        lastPlayTimestamp: state.user.lastPlayTimestamp,
      })),
      update: jest.fn(async ({ data }: any) => {
        state.writes.userUpdate += 1;
        if (data.totalPlaysCount?.increment) {
          state.user.totalPlaysCount += data.totalPlaysCount.increment;
        }
        if (data.lastPlayTimestamp) {
          state.user.lastPlayTimestamp = data.lastPlayTimestamp;
        }
        return {
          totalPlaysCount: state.user.totalPlaysCount,
          referredById: state.user.referredById,
          waitlistBonusUnlocked: false,
        };
      }),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    wallet: {
      findUnique: jest.fn(async () => ({
        userId: state.wallet.userId,
        cashBalance: state.wallet.cashBalance,
        bonusBalance: state.wallet.bonusBalance,
        bonusLocked: state.wallet.bonusLocked,
      })),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const sameCash = state.wallet.cashBalance.equals(where.cashBalance);
        const sameBonus = state.wallet.bonusBalance.equals(where.bonusBalance);
        if (!sameCash || !sameBonus) {
          return { count: 0 };
        }

        state.wallet.cashBalance = data.cashBalance;
        state.wallet.bonusBalance = data.bonusBalance;
        state.writes.walletUpdateMany += 1;
        return { count: 1 };
      }),
      update: jest.fn(async ({ data }: any) => {
        if (data.cashBalance?.increment) {
          state.wallet.cashBalance = state.wallet.cashBalance.plus(data.cashBalance.increment);
        } else if (data.cashBalance !== undefined) {
          state.wallet.cashBalance = data.cashBalance;
        }
        if (data.bonusBalance?.increment) {
          state.wallet.bonusBalance = state.wallet.bonusBalance.plus(data.bonusBalance.increment);
        } else if (data.bonusBalance !== undefined) {
          state.wallet.bonusBalance = data.bonusBalance;
        }
        state.writes.walletUpdate += 1;
          releaseWalletLock();
        return {
          userId: state.wallet.userId,
          cashBalance: state.wallet.cashBalance,
          bonusBalance: state.wallet.bonusBalance,
          bonusLocked: state.wallet.bonusLocked,
        };
      }),
    },
    transaction: {
      findFirst: jest.fn(async () => ({ createdAt: new Date(Date.now() - 10 * 60 * 1000) })),
      create: jest.fn(async () => {
        state.writes.transactionCreate += 1;
        return {};
      }),
      count: jest.fn(async () => 0),
      findMany: jest.fn(async () => []),
    },
    auditLog: {
      create: jest.fn(async () => ({})),
    },
    box: {
      findUnique: jest.fn(async () => ({ ...state.box })),
    },
    boxOpenLog: {
      create: jest.fn(async () => ({})),
    },
    boxOpen: {
      create: jest.fn(async () => {
        state.writes.boxOpenCreate += 1;
        return {};
      }),
    },
    systemStats: {
      upsert: jest.fn(async () => ({})),
    },
    gameConfig: {
      findUnique: jest.fn(async () => ({ id: "global", rtpModifier: 1 })),
    },
  };

  return { tx, state };
}

function createReq(overrides: Record<string, unknown> = {}) {
  return {
    baseUrl: "/api/game",
    path: "/open-box",
    method: "POST",
    headers: {},
    body: {
      boxId: "box-1",
      timestamp: Date.now(),
      ...overrides,
    },
    query: {},
    userId: "user-1",
  } as any;
}

function createRes() {
  const res: any = {};
  res.statusCode = 200;
  res.payload = null;
  res.status = jest.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn().mockImplementation((body: any) => {
    res.payload = body;
    return res;
  });
  return res;
}

describe("abuse stress scenarios", () => {
  beforeEach(() => {
    idempotencyStore.clear();
    replayCounts.clear();
    delete (global as any).__TX__;
    jest.clearAllMocks();
  });

  it("handles 50 parallel open-box requests safely", async () => {
    const { tx, state } = createTx(1000, 0);
    (global as any).__TX__ = tx;

    const results = await Promise.all(
      Array.from({ length: 50 }, () =>
        openBox("user-1", "box-1", "idem-open-stress-1").then(
          (value) => ({ status: "fulfilled" as const, value }),
          (reason) => ({ status: "rejected" as const, reason })
        )
      )
    );

    const fulfilled = results.filter((result) => result.status === "fulfilled").length;
    const rejected = results.filter((result) => result.status === "rejected").length;

    expect(fulfilled).toBeGreaterThanOrEqual(1);
    expect(rejected).toBeGreaterThanOrEqual(0);
    expect(state.writes.boxOpenCreate).toBe(1);
    expect(state.writes.walletUpdateMany).toBe(1);
    expect(state.writes.walletUpdate).toBe(1);
    expect(state.wallet.cashBalance.gte(0)).toBe(true);
    expect(state.wallet.cashBalance.toString()).toBe("925");
  });

  it("handles 20 parallel withdraw requests safely", async () => {
    const { tx, state } = createTx(5000, 0);
    (global as any).__TX__ = tx;

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, idx) =>
        withdrawWallet({ userId: "user-1", amount: d(200), idempotencyKey: `idem-withdraw-stress-${idx + 1}` }).then(
          (value) => ({ status: "fulfilled" as const, value }),
          (reason) => ({ status: "rejected" as const, reason })
        )
      )
    );

    const fulfilled = results.filter((result) => result.status === "fulfilled").length;
    expect(fulfilled).toBeGreaterThanOrEqual(1);
    expect(state.writes.walletUpdate).toBeGreaterThanOrEqual(1);
    expect(state.writes.transactionCreate).toBeGreaterThanOrEqual(1);
    expect(state.wallet.cashBalance.gte(0)).toBe(true);
    expect(state.wallet.cashBalance.toNumber()).toBeLessThanOrEqual(5000);
  });

  it("flags rapid duplicate requests without idempotency key", async () => {
    const req = createReq();
    const responses = await Promise.all(
      Array.from({ length: 10 }, () => {
        const res = createRes();
        const next = jest.fn();
        return replayProtectionMiddleware(req, res, next).then(() => ({ res, next }));
      })
    );

    const nextCount = responses.filter(({ next }) => next.mock.calls.length === 1).length;
    const blockedCount = responses.filter(({ res }) => res.status.mock.calls.some((call: any[]) => call[0] === 409)).length;

    expect(nextCount).toBe(1);
    expect(blockedCount).toBe(9);
  });

  it("returns the same response for replay with the same idempotencyKey", async () => {
    const { tx, state } = createTx(1000, 0);
    (global as any).__TX__ = tx;

    const first = await openBox("user-1", "box-1", "idem-replay-safe-1");
    const second = await openBox("user-1", "box-1", "idem-replay-safe-1");

    expect(first).toEqual(second);
    expect(state.writes.boxOpenCreate).toBe(1);
    expect(state.wallet.cashBalance.gte(0)).toBe(true);
  });
});
