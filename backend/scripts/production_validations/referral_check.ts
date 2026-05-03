import { prisma } from "../../src/config/db";

type Result = {
  ok: boolean;
  details: {
    missingReferralLogsSample: string[];
    usersWithoutInviterSample: string[];
    checkedCount: number;
  };
};

export async function runReferralCheck(): Promise<Result> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h

  // Find recent users who have a referredById set
  const recentReferredUsers = await prisma.user.findMany({
    where: { createdAt: { gte: since }, referredById: { not: null } },
    select: { id: true, referredById: true },
    take: 200,
  });

  const userIds = recentReferredUsers.map((u) => u.id);
  const inviterMap = new Map(recentReferredUsers.map((u) => [u.id, u.referredById]));

  // Load referral logs for these users
  const logs = await prisma.referralLog.findMany({
    where: { referredUserId: { in: userIds } },
    select: { referredUserId: true },
  });

  const loggedSet = new Set(logs.map((l) => l.referredUserId));

  const missingReferralLogs = recentReferredUsers.filter((u) => !loggedSet.has(u.id)).map((u) => u.id);

  // Check inviter existence for sample
  const inviterIds = Array.from(new Set(recentReferredUsers.map((u) => u.referredById!).filter(Boolean)));
  const inviters = await prisma.user.findMany({ where: { id: { in: inviterIds } }, select: { id: true } });
  const inviterExists = new Set(inviters.map((i) => i.id));
  const usersWithMissingInviter = recentReferredUsers.filter((u) => !inviterExists.has(u.referredById!)).map((u) => u.id);

  const ok = missingReferralLogs.length === 0 && usersWithMissingInviter.length === 0;

  return {
    ok,
    details: {
      missingReferralLogsSample: missingReferralLogs.slice(0, 50),
      usersWithoutInviterSample: usersWithMissingInviter.slice(0, 50),
      checkedCount: recentReferredUsers.length,
    },
  };
}

if (require.main === module) {
  void runReferralCheck()
    .then((r) => {
      console.log(JSON.stringify({ script: 'referral_check', result: r }, null, 2));
      process.exit(r.ok ? 0 : 2);
    })
    .catch((err) => {
      console.error('referral_check error', err);
      process.exit(3);
    });
}
