import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../../src/config/env";

const connectionString = env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
async function main() {
  await prisma.box.createMany({
    data: [
      {
        name: "Base Box",
        price: 100,
        rewardTable: [
          { reward: 0, probability: 0.4 },
          { reward: 50, probability: 0.32 },
          { reward: 100, probability: 0.17 },
          { reward: 200, probability: 0.07 },
          { reward: 500, probability: 0.03 },
          { reward: 1000, probability: 0.01 },
        ],
      },
      {
        name: "Prime Box",
        price: 200,
        rewardTable: [
          { reward: 0, probability: 0.45 },
          { reward: 100, probability: 0.3 },
          { reward: 200, probability: 0.16 },
          { reward: 400, probability: 0.07 },
          { reward: 1000, probability: 0.01 },
          { reward: 5000, probability: 0.01 },
        ],
      },
      {
        name: "Mega Box",
        price: 500,
        rewardTable: [
          { reward: 0, probability: 0.5 },
          { reward: 250, probability: 0.3 },
          { reward: 500, probability: 0.1 },
          { reward: 1000, probability: 0.06 },
          { reward: 3000, probability: 0.03 },
          { reward: 10000, probability: 0.01 },
        ],
      },
    ],
  });

  await prisma.vault.createMany({
    data: [
      { name: "Starter Vault", target: 5, reward: 1000 },
      { name: "Pro Vault", target: 10, reward: 3000 },
      { name: "Mega Vault", target: 20, reward: 10000 },
    ],
  });

  await prisma.gameConfig.upsert({
    where: { id: "global" },
    create: { id: "global" },
    update: {},
  });
  
  console.log("Boxes seeded 🚀");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());