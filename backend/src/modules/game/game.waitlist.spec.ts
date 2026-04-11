import { Prisma } from "@prisma/client";
import { openFreeBox } from "./game.service";

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

jest.mock("../../services/reward.service", () => ({
  generateRewardFromDB: jest.fn(),
}));

jest.mock("../../services/referral.service", () => ({
  logReferral: jest.fn(),
  checkReferralLimits: jest.fn(),
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
      freeBoxUsed: initial.freeBoxUsed,
      totalPlaysCount: initial.totalPlaysCount,
      waitlistBonusUnlocked: initial.waitlistBonusUnlocked,
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
        if (select?.freeBoxUsed !== undefined) {
          return {
            id: state.user.id,
            isFrozen: state.user.isFrozen,
            freeBoxUsed: state.user.freeBoxUsed,
            totalPlaysCount: state.user.totalPlaysCount,
            waitlistBonusUnlocked: state.user.waitlistBonusUnlocked,
          };
        }

        return {
          totalPlaysCount: state.user.totalPlaysCount,
          waitlistBonusUnlocked: state.user.waitlistBonusUnlocked,
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
    createIdempotencyKey.mockResolvedValue({});
    completeIdempotencyKey.mockResolvedValue({});
    checkIdempotencyKey.mockResolvedValue(null);
  });

  it("first play reward is always between N150 and N250", async () => {
    const { tx } = buildTx({ totalPlaysCount: 0, freeBoxUsed: false, waitlistBonusUnlocked: false });
    (global as any).__TX__ = tx;

    const result: any = await openFreeBox("u1", "idem-1", "1.1.1.1", "dev-1");
    const reward = Number(result.reward);

    expect(reward).toBeGreaterThanOrEqual(150);
    expect(reward).toBeLessThanOrEqual(250);
  });

  it("free box increments total play count", async () => {
    const { tx } = buildTx({ totalPlaysCount: 2, freeBoxUsed: false, waitlistBonusUnlocked: false });
    (global as any).__TX__ = tx;

    const result: any = await openFreeBox("u1", "idem-2");

    expect(result.totalPlaysCount).toBe(3);
  });

  it("unlocks waitlist bonus when total plays reach 5", async () => {
    const { tx, state } = buildTx({ totalPlaysCount: 4, freeBoxUsed: false, waitlistBonusUnlocked: false });
    (global as any).__TX__ = tx;

    const result: any = await openFreeBox("u1", "idem-3");

    expect(result.totalPlaysCount).toBe(5);
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
