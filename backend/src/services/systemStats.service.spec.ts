jest.mock("../config/db", () => ({
  prisma: {
    systemStats: {
      findUnique: jest.fn(),
    },
    user: {
      create: jest.fn(),
    },
    wallet: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const { prisma: mockPrisma } = jest.requireMock("../config/db");

describe("verifyWalletConstraintIntegrity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("confirms the negative balance update is rejected and always rolls back", async () => {
    const { verifyWalletConstraintIntegrity } = await import("./systemStats.service");

    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        user: {
          create: jest.fn().mockResolvedValue({
            id: "user-1",
            wallet: { id: "wallet-1" },
          }),
        },
        wallet: {
          update: jest.fn().mockRejectedValue({
            code: "P2004",
            message: "Check constraint failed",
          }),
        },
      };

      return callback(tx);
    });

    const result = await verifyWalletConstraintIntegrity();

    expect(result).toEqual({
      valid: true,
      checks: {
        walletNonNegativeBalanceConstraint: true,
        rollbackVerified: true,
      },
      details: ["Wallet negative balance update was rejected by the database"],
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});