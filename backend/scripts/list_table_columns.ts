import { prisma } from "../src/config/db";

async function main() {
  const rows = await prisma.$queryRawUnsafe<Array<{ table_name: string; column_name: string }>>(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('User', 'Transaction', 'ReferralLog')
    ORDER BY table_name, ordinal_position
  `);

  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
