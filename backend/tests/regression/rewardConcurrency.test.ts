import { prisma } from '../../src/config/db';

describe('Reward Grant Concurrency', () => {
  jest.setTimeout(20000);

  it('should never duplicate rewards under concurrency', async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const userId = `test-user-3-${suffix}`;
    const rewardType = 'referral';
    const inviterId = `inv-${userId}`;
    await prisma.user.create({ data: { id: inviterId, platformId: inviterId, referralCode: `REF-${inviterId}` } });
    await prisma.user.create({ data: { id: userId, platformId: userId, referralCode: `REF-${userId}` } });
    // Simulate concurrent reward grants using ReferralRewardGrant model
    await Promise.allSettled([
      prisma.referralRewardGrant.create({ data: { inviterId, referredUserId: userId, amount: 0, sourceAction: rewardType } }),
      prisma.referralRewardGrant.create({ data: { inviterId, referredUserId: userId, amount: 0, sourceAction: rewardType } }),
    ]);
    const count = await prisma.referralRewardGrant.count({ where: { referredUserId: userId, sourceAction: rewardType } });
    expect(count).toBeLessThanOrEqual(1);
  });
});
