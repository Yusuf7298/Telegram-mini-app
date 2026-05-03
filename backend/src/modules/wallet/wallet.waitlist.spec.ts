import { Prisma } from "@prisma/client";
import { withdrawWallet } from "./wallet.service";

jest.mock("../../services/logger", () => ({
  logStructuredEvent: jest.fn().mockResolvedValue(undefined),
  logError: jest.fn().mockResolvedValue(undefined),
  logJackpotSkip: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../services/rules.service", () => ({
  canUserWithdraw: jest.fn(async () => ({ allowed: true })),
}));

jest.mock("../../services/fraudDetection.service", () => ({
  recordWithdrawAttempt: jest.fn(async () => ({ isSuspicious: false })),
}));

jest.mock("../../services/suspiciousActionLog.service", () => ({
  logSuspiciousAction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../services/auditLog.service", () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../utils/lock", () => ({
  withUserLock: async (_userId: string, fn: () => Promise<unknown>) => fn(),
}));

jest.mock("../../services/withTransactionRetry", () => ({
  withTransactionRetry: async (_prisma: unknown, fn: (tx: any) => Promise<unknown>) => fn((global as any).__WALLET_TX__),
}));

const createIdempotencyKey = jest.fn();
const checkIdempotencyKey = jest.fn();
const completeIdempotencyKey = jest.fn();

jest.mock("../../services/idempotency.service", () => ({
  createIdempotencyKey: (...args: any[]) => createIdempotencyKey(...args),
  checkIdempotencyKey: (...args: any[]) => checkIdempotencyKey(...args),
  completeIdempotencyKey: (...args: any[]) => completeIdempotencyKey(...args),
}));

jest.mock("../../config/db", () => ({
  prisma: {
    $transaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) => fn((global as any).__WALLET_TX__)),
  },
}));

const { prisma: mockPrisma } = jest.requireMock("../../config/db");

function d(v: number | string) {
  return new Prisma.Decimal(v);
}

describe("wallet withdraw waitlist unlock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (global as any).__WALLET_TX__;
    createIdempotencyKey.mockResolvedValue({});
    checkIdempotencyKey.mockResolvedValue(null);
    completeIdempotencyKey.mockResolvedValue({});
  });

  it("allows withdrawal from bonus after unlock", async () => {
    const state = {
      wallet: {
        userId: "u1",
        cashBalance: d(0),
        bonusBalance: d(1000),
        bonusLocked: false,
      },
    };

    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      user: {
        findUnique: jest.fn().mockResolvedValue({
          isFrozen: false,
          accountStatus: "ACTIVE",
          riskScore: 0,
          totalPlaysCount: 10,
        }),
      },
      wallet: {
        findUnique: jest.fn().mockResolvedValue(state.wallet),
        update: jest.fn().mockImplementation(async ({ data }: any) => {
          state.wallet.cashBalance = data.cashBalance;
          state.wallet.bonusBalance = data.bonusBalance;
          return state.wallet;
        }),
        updateMany: jest.fn().mockImplementation(async ({ data }: any) => {
          state.wallet.cashBalance = data.cashBalance;
          state.wallet.bonusBalance = data.bonusBalance;
          return { count: 1 };
        }),
      },
      transaction: {
        findFirst: jest.fn().mockResolvedValue({ createdAt: new Date(Date.now() - 10 * 60 * 1000) }),
        create: jest.fn().mockResolvedValue({}),
      },
    };

    (global as any).__WALLET_TX__ = tx;

    await withdrawWallet({ userId: "u1", amount: d(300), idempotencyKey: "wallet-idem-1" });

    expect(state.wallet.cashBalance.toNumber()).toBe(0);
    expect(state.wallet.bonusBalance.toNumber()).toBe(700);
  });
});
