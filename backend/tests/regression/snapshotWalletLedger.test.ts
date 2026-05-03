import { prisma } from '../../src/config/db';

describe('Wallet Ledger Snapshot', () => {
  jest.setTimeout(15000);
    const userId = 'snapshot-wallet-user';

    beforeEach(async () => {
      await prisma.transaction.deleteMany({ where: { userId } });
      await prisma.wallet.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });

      await prisma.user.create({
        data: {
          id: userId,
          platformId: userId,
          referralCode: 'REF-SNAPSHOT-WALLET',
          wallet: {
            create: {
              cashBalance: 1000,
              bonusBalance: 0,
            },
          },
        },
      });

      await prisma.transaction.createMany({
        data: [
          {
            userId,
            type: 'BOX_PURCHASE',
            amount: -100,
            balanceBefore: 1000,
            balanceAfter: 900,
          },
          {
            userId,
            type: 'BOX_REWARD',
            amount: 120,
            balanceBefore: 900,
            balanceAfter: 1020,
          },
        ],
      });
    });

    afterEach(async () => {
      await prisma.transaction.deleteMany({ where: { userId } });
      await prisma.wallet.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    });

  it('should match expected wallet ledger consistency', async () => {
      const ledgers = await prisma.transaction.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    expect(ledgers).toMatchSnapshot();
  });
});
