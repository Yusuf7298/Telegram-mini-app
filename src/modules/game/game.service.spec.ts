import { Prisma } from "@prisma/client";

const mockPrisma = {
  idempotencyKey: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock("../../config/db", () => ({
  prisma: mockPrisma,
}));

import { openBox } from "./game.service";

type DecimalLike = Prisma.Decimal;

type WalletState = {
  cashBalance: DecimalLike;
  bonusBalance: DecimalLike;
};

function d(value: number | string) {
  return new Prisma.Decimal(value);
}

function buildTx(args: {
  walletCash: number;
  walletBonus: number;
  boxPrice: number;
  reward?: number;
}) {
  const reward = args.reward ?? 100;

  const state: WalletState = {
    cashBalance: d(args.walletCash),
    bonusBalance: d(args.walletBonus),
  };

  const transactionCreate = jest.fn().mockResolvedValue({});

  const tx = {
    box: {
      findUnique: jest.fn().mockResolvedValue({
        id: "box-1",
        price: d(args.boxPrice),
        rewardTable: [{ reward, probability: 1 }],
      }),
    },
    wallet: {
      findUnique: jest.fn().mockImplementation(async ({ where }: { where: { userId: string } }) => {
        if (where.userId === "user-1") {
          return {
            userId: "user-1",
            cashBalance: state.cashBalance,
            bonusBalance: state.bonusBalance,
          };
        }
        return null;
      }),
      updateMany: jest.fn().mockImplementation(async ({ data }: any) => {
        state.cashBalance = data.cashBalance;
        state.bonusBalance = data.bonusBalance;
        return { count: 1 };
      }),
      update: jest.fn().mockImplementation(async ({ data }: any) => {
        if (data?.cashBalance?.increment !== undefined) {
          state.cashBalance = state.cashBalance.plus(d(data.cashBalance.increment));
        }

        if (data?.bonusBalance?.increment !== undefined) {
          state.bonusBalance = state.bonusBalance.plus(d(data.bonusBalance.increment));
        }

        return {
          userId: "user-1",
          cashBalance: state.cashBalance,
          bonusBalance: state.bonusBalance,
        };
      }),
    },
    transaction: {
      create: transactionCreate,
    },
    boxOpen: {
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockResolvedValue({}),
    },
    idempotencyKey: {
      create: jest.fn().mockResolvedValue({}),
    },
    user: {
      update: jest.fn().mockResolvedValue({
        paidBoxesOpened: 1,
        welcomeBonusUnlocked: false,
        referredBy: null,
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    vault: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    userVault: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
  };

  return { tx, state, transactionCreate };
}

describe("openBox wallet deduction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.idempotencyKey.findUnique.mockResolvedValue(null);
  });

  async function runCase(input: {
    cash: number;
    bonus: number;
    price: number;
  }) {
    const { tx, state, transactionCreate } = buildTx({
      walletCash: input.cash,
      walletBonus: input.bonus,
      boxPrice: input.price,
    });

    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const reward = await openBox("user-1", "box-1", "idem-1");

    const purchaseCall = transactionCreate.mock.calls.find(
      ([arg]: any[]) => arg?.data?.type === "BOX_PURCHASE"
    );

    if (!purchaseCall) {
      throw new Error("BOX_PURCHASE transaction was not recorded");
    }

    const purchaseData = purchaseCall[0].data;

    return { reward, state, purchaseData };
  }

  it("CASE 1: cash only", async () => {
    const { reward, state, purchaseData } = await runCase({
      cash: 500,
      bonus: 100,
      price: 200,
    });

    expect(reward).toBe(100);
    expect(purchaseData.meta.cashUsed).toBe("200");
    expect(purchaseData.meta.bonusUsed).toBe("0");

    const totalDeduction = d(purchaseData.meta.cashUsed).plus(d(purchaseData.meta.bonusUsed));
    expect(totalDeduction.equals(d(200))).toBe(true);

    const expectedNewCashAfterReward = d(300).plus(d(100));
    expect(state.cashBalance.equals(expectedNewCashAfterReward)).toBe(true);
    expect(state.bonusBalance.equals(d(100))).toBe(true);
    expect(state.cashBalance.greaterThanOrEqualTo(0)).toBe(true);
    expect(state.bonusBalance.greaterThanOrEqualTo(0)).toBe(true);
  });

  it("CASE 2: cash + bonus", async () => {
    const { reward, state, purchaseData } = await runCase({
      cash: 100,
      bonus: 200,
      price: 250,
    });

    expect(reward).toBe(100);
    expect(purchaseData.meta.cashUsed).toBe("100");
    expect(purchaseData.meta.bonusUsed).toBe("150");

    const totalDeduction = d(purchaseData.meta.cashUsed).plus(d(purchaseData.meta.bonusUsed));
    expect(totalDeduction.equals(d(250))).toBe(true);

    const expectedNewCashAfterReward = d(0).plus(d(100));
    expect(state.cashBalance.equals(expectedNewCashAfterReward)).toBe(true);
    expect(state.bonusBalance.equals(d(50))).toBe(true);
    expect(state.cashBalance.greaterThanOrEqualTo(0)).toBe(true);
    expect(state.bonusBalance.greaterThanOrEqualTo(0)).toBe(true);
  });

  it("CASE 3: bonus only", async () => {
    const { reward, state, purchaseData } = await runCase({
      cash: 0,
      bonus: 300,
      price: 200,
    });

    expect(reward).toBe(100);
    expect(purchaseData.meta.cashUsed).toBe("0");
    expect(purchaseData.meta.bonusUsed).toBe("200");

    const totalDeduction = d(purchaseData.meta.cashUsed).plus(d(purchaseData.meta.bonusUsed));
    expect(totalDeduction.equals(d(200))).toBe(true);

    const expectedNewCashAfterReward = d(0).plus(d(100));
    expect(state.cashBalance.equals(expectedNewCashAfterReward)).toBe(true);
    expect(state.bonusBalance.equals(d(100))).toBe(true);
    expect(state.cashBalance.greaterThanOrEqualTo(0)).toBe(true);
    expect(state.bonusBalance.greaterThanOrEqualTo(0)).toBe(true);
  });

  it("CASE 4: exact match", async () => {
    const { reward, state, purchaseData } = await runCase({
      cash: 100,
      bonus: 100,
      price: 200,
    });

    expect(reward).toBe(100);
    expect(purchaseData.meta.cashUsed).toBe("100");
    expect(purchaseData.meta.bonusUsed).toBe("100");

    const totalDeduction = d(purchaseData.meta.cashUsed).plus(d(purchaseData.meta.bonusUsed));
    expect(totalDeduction.equals(d(200))).toBe(true);

    const expectedNewCashAfterReward = d(0).plus(d(100));
    expect(state.cashBalance.equals(expectedNewCashAfterReward)).toBe(true);
    expect(state.bonusBalance.equals(d(0))).toBe(true);
    expect(state.cashBalance.greaterThanOrEqualTo(0)).toBe(true);
    expect(state.bonusBalance.greaterThanOrEqualTo(0)).toBe(true);
  });

  it("CASE 5: insufficient balance", async () => {
    const { tx } = buildTx({
      walletCash: 50,
      walletBonus: 100,
      boxPrice: 200,
    });

    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    await expect(openBox("user-1", "box-1", "idem-1")).rejects.toThrow(
      "Insufficient balance"
    );

    expect(tx.transaction.create).not.toHaveBeenCalled();
  });
});
