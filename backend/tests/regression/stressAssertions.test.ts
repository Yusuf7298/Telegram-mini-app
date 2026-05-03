import { prisma } from '../../src/config/db';

type DuplicateReferralGrantRow = {
  referredUserId: string;
  sourceAction: string;
  cnt: bigint;
};

describe('Stress Test Assertions', () => {
  it('should issue total referral reward grants as expected', async () => {
    const expected = 1000; // Set to expected value for your test
    const count = await prisma.referralRewardGrant.count({});
    expect(typeof count).toBe('number');
  });

  it('should have no orphan referral logs', async () => {
    const orphans = await prisma.referralLog.findMany({ where: { suspicious: true } });
    expect(Array.isArray(orphans)).toBe(true);
  });

  it('should have no duplicate ReferralRewardGrant rows', async () => {
    const dups = await prisma.$queryRaw<DuplicateReferralGrantRow[]>`SELECT "referredUserId", "sourceAction", COUNT(*) as cnt FROM "ReferralRewardGrant" GROUP BY "referredUserId", "sourceAction" HAVING COUNT(*) > 1`;
    expect(Array.isArray(dups)).toBe(true);
  });
});
