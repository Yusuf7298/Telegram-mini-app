import { findOrCreateTelegramUser } from "./auth.service";

jest.mock("../config/db", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const { prisma: mockPrisma } = jest.requireMock("../config/db");

jest.mock("./suspiciousActionLog.service", () => ({
  logSuspiciousAction: jest.fn(),
}));

describe("waitlist onboarding auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("grants locked N1000 waitlist bonus for a new Telegram user", async () => {
    const createdUser = { id: "u1", platformId: "123", waitlistBonusGranted: true };
    const createMock = jest.fn().mockResolvedValue(createdUser);

    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        user: {
          create: createMock,
        },
      };
      return fn(tx);
    });

    mockPrisma.user.count.mockResolvedValue(1);

    const user = await findOrCreateTelegramUser("123", "john", { username: "john" }, "1.1.1.1", "d1");

    expect(user?.id).toBe("u1");
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          platformId: "123",
          waitlistBonusGranted: true,
          waitlistBonusUnlocked: false,
          totalPlaysCount: 0,
          wallet: {
            create: expect.objectContaining({
              bonusBalance: 1000,
              bonusLocked: true,
            }),
          },
        }),
      })
    );
  });
});
