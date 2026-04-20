import { prisma } from "../src/config/db";

async function main() {
  const rows = await prisma.$queryRawUnsafe<Array<{ table_schema: string; table_name: string }>>(
    "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );

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
