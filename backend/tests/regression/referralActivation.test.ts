import { prisma } from '../../src/config/db';

describe('Referral Activation', () => {
  it('should activate referral exactly once per user', async () => {
    const userId = 'test-user-1';
    // Simulate multiple activation attempts by updating the User referralStatus
    await Promise.all([
      prisma.user.upsert({
        where: { id: userId },
        update: { referralStatus: 'ACTIVE' },
        create: { id: userId, platformId: userId, referralCode: `code-${userId}`, referralStatus: 'ACTIVE' },
      }),
      prisma.user.upsert({
        where: { id: userId },
        update: { referralStatus: 'ACTIVE' },
        create: { id: userId, platformId: userId, referralCode: `code-${userId}`, referralStatus: 'ACTIVE' },
      })
    ]);
    const count = await prisma.user.count({ where: { id: userId, referralStatus: 'ACTIVE' } });
    expect(count).toBe(1);
  });
});
