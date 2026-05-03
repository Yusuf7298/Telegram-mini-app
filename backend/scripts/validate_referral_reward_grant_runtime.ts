import { prisma } from "../src/config/db";

async function main() {
  const columns = await prisma.$queryRawUnsafe(
    "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ReferralRewardGrant' ORDER BY ordinal_position"
  );

  const constraints = await prisma.$queryRawUnsafe(
    "SELECT tc.constraint_name, tc.constraint_type, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name FROM information_schema.table_constraints tc LEFT JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema LEFT JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema WHERE tc.table_schema = 'public' AND tc.table_name = 'ReferralRewardGrant' ORDER BY tc.constraint_type, tc.constraint_name"
  );

  const indexes = await prisma.$queryRawUnsafe(
    "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'ReferralRewardGrant' ORDER BY indexname"
  );

  const checkQuery = await prisma.referralRewardGrant.findMany({
    take: 1,
    select: {
      id: true,
      inviterId: true,
      referredUserId: true,
      amount: true,
      sourceAction: true,
      createdAt: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        prismaClientQueryOk: true,
        columns,
        constraints,
        indexes,
        sampleCount: checkQuery.length,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ prismaClientQueryOk: false, error: message }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
