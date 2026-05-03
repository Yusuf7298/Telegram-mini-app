import { prisma } from '../../src/config/db';

describe('Referral Lifecycle Snapshot', () => {
  const inviterId = 'snapshot-ref-inviter';
  const referredId = 'snapshot-ref-referred';

  beforeEach(async () => {
    await prisma.referralLog.deleteMany({
      where: {
        OR: [{ inviterId }, { referredUserId: referredId }],
      },
    });
    await prisma.wallet.deleteMany({ where: { userId: { in: [inviterId, referredId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [inviterId, referredId] } } });

    await prisma.user.create({ data: { id: inviterId, platformId: inviterId, referralCode: 'REF-SNAPSHOT-INV' } });
    await prisma.user.create({ data: { id: referredId, platformId: referredId, referralCode: 'REF-SNAPSHOT-REF' } });

    await prisma.referralLog.createMany({
      data: [
        {
          inviterId,
          referredUserId: referredId,
          ip: '127.0.0.1',
          deviceId: 'snapshot-device-1',
          suspicious: false,
        },
      ],
    });
  });

  afterEach(async () => {
    await prisma.referralLog.deleteMany({
      where: {
        OR: [{ inviterId }, { referredUserId: referredId }],
      },
    });
    await prisma.wallet.deleteMany({ where: { userId: { in: [inviterId, referredId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [inviterId, referredId] } } });
  });

  it('should match expected referral states', async () => {
    const states = await prisma.referralLog.findMany({ where: { inviterId, referredUserId: referredId }, orderBy: { createdAt: 'asc' } });
    expect(states).toMatchSnapshot();
  });
});
