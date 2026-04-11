import { Prisma } from "@prisma/client";
import { withdrawWallet } from "./wallet.service";

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
    $transaction: jest.fn(),
  },
}));

const { prisma: mockPrisma } = jest.requireMock("../../config/db");

function d(v: number | string) {
  return new Prisma.Decimal(v);
}

describe("wallet withdraw waitlist unlock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      wallet: {
        findUnique: jest.fn().mockResolvedValue(state.wallet),
        updateMany: jest.fn().mockImplementation(async ({ data }: any) => {
          state.wallet.cashBalance = data.cashBalance;
          state.wallet.bonusBalance = data.bonusBalance;
          return { count: 1 };
        }),
      },
      transaction: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    (global as any).__WALLET_TX__ = tx;

    await withdrawWallet("u1", d(300), "wallet-idem-1");

    expect(state.wallet.cashBalance.toNumber()).toBe(0);
    expect(state.wallet.bonusBalance.toNumber()).toBe(700);
  });
});
