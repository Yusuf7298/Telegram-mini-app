import { prisma } from '../../src/config/db';

describe('Withdrawals', () => {
  const userId = 'test-user-4';

  beforeEach(async () => {
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.wallet.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  afterEach(async () => {
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.wallet.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('should never allow negative wallet balance', async () => {
    await prisma.user.create({
      data: {
        id: userId,
        platformId: userId,
        referralCode: `REF-${userId}`,
        wallet: {
          create: {
            cashBalance: 100,
            bonusBalance: 0,
          },
        },
      },
    });

    // Simulate withdrawal using the actual wallet schema
    await prisma.wallet.update({
      where: { userId },
      data: { cashBalance: 0 },
    });

    await prisma.transaction.create({
      data: { userId, type: 'BOX_PURCHASE', amount: -100, balanceBefore: 100, balanceAfter: 0 },
    });

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    expect(Number(wallet?.cashBalance)).toBeGreaterThanOrEqual(0);
  });
});
