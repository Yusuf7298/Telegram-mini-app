import { prisma } from "../src/config/db";

type ActiveReferralGrantRow = {
  userId: string;
  platformId: string;
  referralStatus: string;
  grantCount: bigint | number;
};

type DuplicateGrantRow = {
  referredUserId: string;
  grantCount: bigint | number;
};

function toNumber(value: bigint | number | string) {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string") {
    return Number(value);
  }
  return value;
}

async function main() {
  const activeReferralIssues = await prisma.$queryRaw<ActiveReferralGrantRow[]>`
    SELECT
      u.id AS "userId",
      u."platformId",
      u."referralStatus",
      COUNT(rg.id) AS "grantCount"
    FROM "User" u
    LEFT JOIN "ReferralRewardGrant" rg
      ON rg."referredUserId" = u.id
    WHERE u."referralStatus" = 'ACTIVE'
    GROUP BY u.id, u."platformId", u."referralStatus"
    HAVING COUNT(rg.id) <> 1
    ORDER BY u."createdAt" DESC
  `;

  const duplicateGrants = await prisma.$queryRaw<DuplicateGrantRow[]>`
    SELECT
      rg."referredUserId",
      COUNT(*) AS "grantCount"
    FROM "ReferralRewardGrant" rg
    GROUP BY rg."referredUserId"
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, rg."referredUserId" ASC
  `;

  const output = {
    activeReferralIssues: activeReferralIssues.map((row) => ({
      userId: row.userId,
      platformId: row.platformId,
      referralStatus: row.referralStatus,
      grantCount: toNumber(row.grantCount),
    })),
    duplicateGrants: duplicateGrants.map((row) => ({
      referredUserId: row.referredUserId,
      grantCount: toNumber(row.grantCount),
    })),
    totals: {
      activeReferralIssues: activeReferralIssues.length,
      duplicateGrants: duplicateGrants.length,
    },
  };

  console.log(JSON.stringify(output, null, 2));

  if (activeReferralIssues.length > 0 || duplicateGrants.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ error: message }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
