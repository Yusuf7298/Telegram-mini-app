import { Prisma } from "@prisma/client";
import { openFreeBox } from "./game.service";

jest.mock("../../services/logger", () => ({
  logStructuredEvent: jest.fn().mockResolvedValue(undefined),
  logError: jest.fn().mockResolvedValue(undefined),
  logJackpotSkip: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../services/fraudDetection.service", () => ({
  recordBoxOpenAttempt: jest.fn(async () => ({ isSuspicious: false })),
  recordRewardEvent: jest.fn(async () => ({ isSuspicious: false })),
  recordReferralActivationForInviter: jest.fn(async () => ({ isAnomalous: false, count: 1, timeframeMs: 300000 })),
  recordReferralRewardForInviter: jest.fn(async () => ({ isAnomalous: false, count: 1, timeframeMs: 300000 })),
}));

jest.mock("../../services/reward.service", () => ({
  generateReward: jest.fn(() => new Prisma.Decimal(200)),
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
    minBoxReward: 150,
    maxBoxReward: 251,
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

jest.mock("../../services/rules.service", () => ({
  canUserPlay: jest.fn(async () => true),
  isCooldownActive: jest.fn(async () => ({ active: false, elapsedMs: 0, cooldownMs: 0 })),
  canUnlockWaitlistBonus: jest.fn(async ({ user }: any) =>
    user.totalPlaysCount >= 5 && !user.waitlistBonusUnlocked && user.waitlistBonusEligible
  ),
  isRapidOnboardingCompletion: jest.fn(async () => false),
  shouldEvaluateReferralOnPlay: jest.fn(() => false),
  canActivateReferral: jest.fn((referral: { status: string }) => referral.status === "JOINED"),
}));

jest.mock("../../config/db", () => ({
  prisma: {},
}));

jest.mock("../../utils/lock", () => ({
  withUserLock: async (_userId: string, fn: () => Promise<unknown>) => fn(),
}));

const completeIdempotencyKey = jest.fn();
const createIdempotencyKey = jest.fn();
const checkIdempotencyKey = jest.fn();

jest.mock("../../services/idempotency.service", () => ({
  createIdempotencyKey: (...args: any[]) => createIdempotencyKey(...args),
  completeIdempotencyKey: (...args: any[]) => completeIdempotencyKey(...args),
  checkIdempotencyKey: (...args: any[]) => checkIdempotencyKey(...args),
}));

jest.mock("../../services/referral.service", () => ({
  logReferral: jest.fn(),
  checkReferralLimits: jest.fn(),
  activateReferralFromJoinedToActive: jest.fn(async () => null),
}));

jest.mock("../../services/suspiciousActionLog.service", () => ({
  logSuspiciousAction: jest.fn(),
}));

jest.mock("../../services/auditLog.service", () => ({
  logAudit: jest.fn(),
}));

jest.mock("../../services/bonus.service", () => ({
  trackBonusUsage: jest.fn(),
}));

jest.mock("../../services/withTransactionRetry", () => ({
  withTransactionRetry: async (_prisma: unknown, fn: (tx: any) => Promise<unknown>) => fn((global as any).__TX__),
}));

function d(v: number | string) {
  return new Prisma.Decimal(v);
}

function buildTx(initial: { totalPlaysCount: number; freeBoxUsed: boolean; waitlistBonusUnlocked: boolean }) {
  const state = {
    user: {
      id: "u1",
      isFrozen: false,
      accountStatus: "ACTIVE",
      riskScore: 0,
      freeBoxUsed: initial.freeBoxUsed,
      totalPlaysCount: initial.totalPlaysCount,
      waitlistBonusUnlocked: initial.waitlistBonusUnlocked,
      waitlistBonusEligible: true,
    },
    wallet: {
      userId: "u1",
      cashBalance: d(0),
      bonusBalance: d(1000),
      bonusLocked: !initial.waitlistBonusUnlocked,
    },
  };

  const tx = {
    user: {
      findUnique: jest.fn().mockImplementation(async ({ select }: any) => {
        if (select && typeof select === "object") {
          const selected: Record<string, unknown> = {};
          for (const key of Object.keys(select)) {
            selected[key] = (state.user as Record<string, unknown>)[key];
          }
          return selected;
        }

        return {
          ...state.user,
        };
      }),
      updateMany: jest.fn().mockImplementation(async () => {
        if (state.user.freeBoxUsed) return { count: 0 };
        state.user.freeBoxUsed = true;
        return { count: 1 };
      }),
      update: jest.fn().mockImplementation(async ({ data }: any) => {
        if (data?.totalPlaysCount?.increment) {
          state.user.totalPlaysCount += data.totalPlaysCount.increment;
        }
        if (data?.waitlistBonusUnlocked === true) {
          state.user.waitlistBonusUnlocked = true;
        }
        return {
          totalPlaysCount: state.user.totalPlaysCount,
          waitlistBonusUnlocked: state.user.waitlistBonusUnlocked,
        };
      }),
    },
    wallet: {
      findUnique: jest.fn().mockResolvedValue(state.wallet),
      update: jest.fn().mockImplementation(async ({ data }: any) => {
        if (data?.cashBalance?.increment) {
          state.wallet.cashBalance = state.wallet.cashBalance.plus(data.cashBalance.increment);
        }
        if (data?.bonusLocked === false) {
          state.wallet.bonusLocked = false;
        }
        return state.wallet;
      }),
    },
    boxOpenLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    transaction: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([
        { createdAt: new Date() },
        { createdAt: new Date(Date.now() - 10_000) },
        { createdAt: new Date(Date.now() - 20_000) },
        { createdAt: new Date(Date.now() - 30_000) },
        { createdAt: new Date(Date.now() - 40_000) },
      ]),
    },
  };

  return { tx, state };
}

describe("waitlist free-box flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (global as any).__TX__;
    createIdempotencyKey.mockResolvedValue({});
    completeIdempotencyKey.mockImplementation(async ({ response }: any) => {
      if (response && response.success === true && Object.prototype.hasOwnProperty.call(response, "data")) {
        return response;
      }
      return { success: true, data: response, error: null };
    });
    checkIdempotencyKey.mockResolvedValue(null);
  });

  it("first play reward is always between N150 and N250", async () => {
    const { tx } = buildTx({ totalPlaysCount: 0, freeBoxUsed: false, waitlistBonusUnlocked: false });
    (global as any).__TX__ = tx;

    const result: any = await openFreeBox("u1", "idem-1", "1.1.1.1", "dev-1");
    const reward = Number(result?.data?.reward);

    expect(reward).toBe(200);
  });

  it("free box increments total play count", async () => {
    const { tx } = buildTx({ totalPlaysCount: 2, freeBoxUsed: false, waitlistBonusUnlocked: false });
    (global as any).__TX__ = tx;

    const result: any = await openFreeBox("u1", "idem-2");

    expect(result?.data?.totalPlaysCount).toBe(3);
  });

  it("unlocks waitlist bonus when total plays reach 5", async () => {
    const { tx, state } = buildTx({ totalPlaysCount: 4, freeBoxUsed: false, waitlistBonusUnlocked: false });
    (global as any).__TX__ = tx;

    const result: any = await openFreeBox("u1", "idem-3");

    expect(result?.data?.totalPlaysCount).toBe(5);
    expect(state.user.waitlistBonusUnlocked).toBe(true);
    expect(state.wallet.bonusLocked).toBe(false);
  });

  it("does not trigger unlock twice when already unlocked", async () => {
    const { tx, state } = buildTx({ totalPlaysCount: 6, freeBoxUsed: false, waitlistBonusUnlocked: true });
    (global as any).__TX__ = tx;

    await openFreeBox("u1", "idem-4");

    const unlockCalls = tx.wallet.update.mock.calls.filter(
      (call: any[]) => call[0]?.data?.bonusLocked === false
    );

    expect(unlockCalls.length).toBe(0);
    expect(state.wallet.bonusLocked).toBe(false);
  });

  it("blocks concurrent replay of free box usage", async () => {
    const { tx } = buildTx({ totalPlaysCount: 0, freeBoxUsed: false, waitlistBonusUnlocked: false });
    (global as any).__TX__ = tx;

    const [a, b] = await Promise.allSettled([
      openFreeBox("u1", "idem-5"),
      openFreeBox("u1", "idem-6"),
    ]);

    expect([a.status, b.status].sort()).toEqual(["fulfilled", "rejected"]);
  });
});
