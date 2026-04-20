import { prisma } from "../src/config/db";

type AffectedUser = {
  id: string;
  platformId: string;
  referredById: string | null;
  totalPlaysCount: number;
  referralActivityMet: boolean | null;
  referralRewardPending: boolean | null;
  createdAt: Date;
};

type ReferralLogJoinedUser = {
  referredId: string;
  referrerId: string;
  createdAt: Date;
  platformId: string;
  totalPlaysCount: number;
  referralActivityMet: boolean | null;
  referralRewardPending: boolean | null;
};

type SummaryRow = {
  totalReferredPlayers: string;
  missedActivationCandidates: string;
  rewardPendingCount: string;
  activityMetFalseCount: string;
};

async function main() {
  const summaryRows = await prisma.$queryRaw<SummaryRow[]>`
    SELECT
      COUNT(*) FILTER (WHERE u."referredById" IS NOT NULL AND COALESCE(u."totalPlaysCount", 0) > 0) AS "totalReferredPlayers",
      COUNT(*) FILTER (
        WHERE u."referredById" IS NOT NULL
          AND COALESCE(u."totalPlaysCount", 0) > 0
          AND COALESCE(u."referralActivityMet", false) = false
      ) AS "missedActivationCandidates",
      COUNT(*) FILTER (
        WHERE u."referredById" IS NOT NULL
          AND COALESCE(u."totalPlaysCount", 0) > 0
          AND COALESCE(u."referralRewardPending", false) = true
      ) AS "rewardPendingCount",
      COUNT(*) FILTER (
        WHERE u."referredById" IS NOT NULL
          AND COALESCE(u."totalPlaysCount", 0) > 0
          AND COALESCE(u."referralActivityMet", false) = false
      ) AS "activityMetFalseCount"
    FROM "User" u
  `;

  const summary = summaryRows[0] ?? {
    totalReferredPlayers: "0",
    missedActivationCandidates: "0",
    rewardPendingCount: "0",
    activityMetFalseCount: "0",
  };

  const affectedUsers = await prisma.$queryRaw<AffectedUser[]>`
    SELECT
      u.id,
      u."platformId",
      u."referredById",
      u."totalPlaysCount",
      u."referralActivityMet",
      u."referralRewardPending",
      u."createdAt"
    FROM "User" u
    WHERE u."referredById" IS NOT NULL
      AND COALESCE(u."totalPlaysCount", 0) > 0
      AND COALESCE(u."referralActivityMet", false) = false
    ORDER BY u."createdAt" DESC
    LIMIT 200
  `;

  const referralLogBackedUsers = await prisma.$queryRaw<ReferralLogJoinedUser[]>`
    SELECT
      rl."referredId",
      rl."referrerId",
      rl."createdAt",
      u."platformId",
      u."totalPlaysCount",
      u."referralActivityMet",
      u."referralRewardPending"
    FROM "ReferralLog" rl
    JOIN "User" u ON u.id = rl."referredId"
    WHERE COALESCE(u."totalPlaysCount", 0) > 0
      AND COALESCE(u."referralActivityMet", false) = false
    ORDER BY rl."createdAt" DESC
    LIMIT 200
  `;

  const payload = { summary, affectedUsers, referralLogBackedUsers };
  console.log(
    JSON.stringify(payload, (_key, value) => (typeof value === "bigint" ? value.toString() : value), 2)
  );
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
