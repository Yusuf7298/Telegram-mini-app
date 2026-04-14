// @ts-nocheck
import { Prisma } from "@prisma/client";
import { withdrawWallet } from "./wallet.service";

jest.mock("../../utils/lock", () => ({
  withUserLock: async (_userId: string, fn: () => Promise<unknown>) => fn(),
}));

jest.mock("../../services/withTransactionRetry", () => ({
  withTransactionRetry: async (_prisma: unknown, fn: (tx: any) => Promise<unknown>) => fn((global as any).__TX__),
}));

const idempotencyStore = new Map<string, any>();

function normalizeResponse(response: any) {
  if (response && response.success === true && Object.prototype.hasOwnProperty.call(response, "data")) {
    return response;
  }
  return { success: true, data: response, error: null };
}

const createIdempotencyKey = jest.fn(async ({ id, userId, action }: any) => {
  if (idempotencyStore.has(id)) {
    throw new Error("Idempotency key already exists");
  }
  const key = { id, userId, action, status: "PENDING", response: null };
  idempotencyStore.set(id, key);
  return key;
});

const checkIdempotencyKey = jest.fn(async ({ id, userId }: any) => {
  const key = idempotencyStore.get(id) || null;
  if (!key) return null;
  if (key.userId !== userId) throw new Error("Idempotency key user mismatch");
  return key;
});

const completeIdempotencyKey = jest.fn(async ({ id, userId, response }: any) => {
  const existing = idempotencyStore.get(id);
  if (!existing) throw new Error("Idempotency key not found");
  if (existing.userId !== userId) throw new Error("Idempotency key user mismatch");
  const normalized = normalizeResponse(response);
  const completed = { ...existing, status: "COMPLETED", response: normalized };
  idempotencyStore.set(id, completed);
  return normalized;
});

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

function d(v: number | string) {
  return new Prisma.Decimal(v);
}

function buildWalletTx(initialCash = 100, initialBonus = 0) {
  const state = {
    wallet: {
      userId: "user-1",
      cashBalance: d(initialCash),
      bonusBalance: d(initialBonus),
      bonusLocked: false,
    },
    writes: {
      updateMany: 0,
      transactionCreate: 0,
    },
  };

  const tx = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        accountStatus: "ACTIVE",
        riskScore: 0,
        totalPlaysCount: 10,
      }),
    },
    transaction: {
      findFirst: jest.fn().mockResolvedValue({
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
      }),
      create: jest.fn().mockImplementation(async () => {
        state.writes.transactionCreate += 1;
        return {};
      }),
    },
    wallet: {
      findUnique: jest.fn().mockImplementation(async () => ({
        userId: state.wallet.userId,
        cashBalance: state.wallet.cashBalance,
        bonusBalance: state.wallet.bonusBalance,
        bonusLocked: state.wallet.bonusLocked,
      })),
      updateMany: jest.fn().mockImplementation(async ({ where, data }: any) => {
        const whereCash = where.cashBalance;
        const whereBonus = where.bonusBalance;
        const currentCash = state.wallet.cashBalance;
        const currentBonus = state.wallet.bonusBalance;

        const sameVersion = currentCash.equals(whereCash) && currentBonus.equals(whereBonus);
        if (!sameVersion) {
          return { count: 0 };
        }

        state.wallet.cashBalance = data.cashBalance;
        state.wallet.bonusBalance = data.bonusBalance;
        state.writes.updateMany += 1;
        return { count: 1 };
      }),
    },
  };

  return { tx, state };
}

describe("financial idempotency integration", () => {
  beforeEach(() => {
    idempotencyStore.clear();
    jest.clearAllMocks();
  });

  it("idempotent replay: same request 5 times returns identical response with one DB write", async () => {
    const { tx, state } = buildWalletTx(100, 0);
    (global as any).__TX__ = tx;

    const responses = [];
    for (let i = 0; i < 5; i++) {
      // same user, amount and idempotency key
      const response = await withdrawWallet("user-1", d(10), "idem-replay-1");
      responses.push(response);
    }

    expect(responses).toHaveLength(5);
    for (let i = 1; i < responses.length; i++) {
      expect(responses[i]).toEqual(responses[0]);
    }

    expect(state.writes.updateMany).toBe(1);
    expect(state.writes.transactionCreate).toBe(1);
  });

  it("parallel double-spend: two concurrent withdraws yields one success and one failure", async () => {
    const { tx } = buildWalletTx(100, 0);
    (global as any).__TX__ = tx;

    const [a, b] = await Promise.allSettled([
      withdrawWallet("user-1", d(80), "idem-parallel-a"),
      withdrawWallet("user-1", d(80), "idem-parallel-b"),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(["fulfilled", "rejected"]);
  });

  it("mixed retry (network retry): second call returns same stored response", async () => {
    const { tx } = buildWalletTx(120, 0);
    (global as any).__TX__ = tx;

    const first = await withdrawWallet("user-1", d(15), "idem-retry-1");
    const second = await withdrawWallet("user-1", d(15), "idem-retry-1");

    expect(second).toEqual(first);
  });
});
