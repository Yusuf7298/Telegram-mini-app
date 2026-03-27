const mockPrisma = {
  $transaction: jest.fn(),
  userVault: {
    findMany: jest.fn(),
  },
};

jest.mock("../../config/db", () => ({
  prisma: mockPrisma,
}));

import { Prisma } from "@prisma/client";
import { claimVault } from "./vault.service";

function d(value: number | string) {
  return new Prisma.Decimal(value);
}

describe("claimVault", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("claims vault reward successfully", async () => {
    const tx = {
      userVault: {
        findUnique: jest.fn().mockResolvedValue({
          id: "uv-1",
          userId: "user-1",
          vaultId: "vault-1",
          progress: 5,
          claimed: false,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      vault: {
        findUnique: jest.fn().mockResolvedValue({
          id: "vault-1",
          target: 5,
          reward: d(1000),
        }),
      },
      wallet: {
        findUnique: jest.fn().mockResolvedValue({
          userId: "user-1",
          cashBalance: d(500),
          bonusBalance: d(200),
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      transaction: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const reward = await claimVault("user-1", "vault-1");

    expect(reward.equals(d(1000))).toBe(true);
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { cashBalance: { increment: d(1000) } },
    });
    expect(tx.userVault.update).toHaveBeenCalledWith({
      where: { id: "uv-1" },
      data: { claimed: true },
    });
  });

  it("prevents double claim", async () => {
    const tx = {
      userVault: {
        findUnique: jest.fn().mockResolvedValue({
          id: "uv-1",
          userId: "user-1",
          vaultId: "vault-1",
          progress: 5,
          claimed: true,
        }),
        update: jest.fn(),
      },
      vault: {
        findUnique: jest.fn(),
      },
      wallet: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
      },
    };

    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    await expect(claimVault("user-1", "vault-1")).rejects.toThrow(
      "Already claimed"
    );

    expect(tx.wallet.update).not.toHaveBeenCalled();
    expect(tx.transaction.create).not.toHaveBeenCalled();
  });
});
