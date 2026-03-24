import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ connectionString });

const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.box.createMany({
    data: [
      { name: "Mini Box", price: 100 },
      { name: "Big Box", price: 200 },
      { name: "Mega Box", price: 500 }
    ],
  });

// Use the correct model name as defined in your Prisma schema, e.g., 'vault'
  await prisma.vault.createMany({
    data: [
      { name: "Starter Vault", target: 5, reward: 1000 },
      { name: "Pro Vault", target: 10, reward: 3000 },
      { name: "Mega Vault", target: 20, reward: 10000 },
    ],
  });

  console.log("Boxes seeded 🚀");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());