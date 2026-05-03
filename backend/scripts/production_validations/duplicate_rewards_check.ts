import { prisma } from "../../src/config/db";

type Result = {
  ok: boolean;
  details: {
    duplicateGrants: { referredUserId: string; count: number }[];
    checkedCount: number;
  };
};

export async function runDuplicateRewardsCheck(): Promise<Result> {
  // Group referralRewardGrant by referredUserId and detect counts > 1
  const groups = await prisma.referralRewardGrant.groupBy({
    by: ['referredUserId'],
    _count: { _all: true },
    orderBy: { referredUserId: 'asc' },
    take: 200,
  });

  const duplicates = groups
    .filter((g) => (g._count?._all ?? 0) > 1)
    .map((g) => ({ referredUserId: g.referredUserId, count: g._count?._all ?? 0 }));

  return {
    ok: duplicates.length === 0,
    details: {
      duplicateGrants: duplicates,
      checkedCount: groups.length,
    },
  };
}

if (require.main === module) {
  void runDuplicateRewardsCheck()
    .then((r) => {
      console.log(JSON.stringify({ script: 'duplicate_rewards_check', result: r }, null, 2));
      process.exit(r.ok ? 0 : 2);
    })
    .catch((err) => {
      console.error('duplicate_rewards_check error', err);
      process.exit(3);
    });
}
