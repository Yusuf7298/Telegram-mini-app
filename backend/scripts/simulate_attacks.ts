import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { v4 as uuidv4 } from "uuid";
import { env } from "../src/config/env";

const connectionString = env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const report: any = {};
  // Setup: create test user, wallet, box
  let user = await prisma.user.findFirst({ where: { platformId: "attacktestuser" } });
  if (!user) user = await prisma.user.create({ data: { platformId: "attacktestuser" } });
  let wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (!wallet) wallet = await prisma.wallet.create({ data: { userId: user.id, cashBalance: new Prisma.Decimal(10000) } });
  let box = await prisma.box.findFirst();
  if (!box) throw new Error("No box found");

  // 1. 100 concurrent box opens (same user)
  const idempotencyKeys = Array.from({ length: 100 }, () => uuidv4());
  let concurrentSuccess = 0, concurrentFail = 0;
  await Promise.all(idempotencyKeys.map(async (key) => {
    try {
      await prisma.$executeRaw`SELECT open_box(${user.id}, ${box.id}, ${key})`;
      concurrentSuccess++;
    } catch {
      concurrentFail++;
    }
  }));
  report.concurrentBoxOpens = { success: concurrentSuccess, fail: concurrentFail };

  // 2. Replay requests with different idempotency keys
  let replaySuccess = 0, replayFail = 0;
  for (let i = 0; i < 10; ++i) {
    try {
      await prisma.$executeRaw`SELECT open_box(${user.id}, ${box.id}, ${uuidv4()})`;
      replaySuccess++;
    } catch {
      replayFail++;
    }
  }
  report.replayRequests = { success: replaySuccess, fail: replayFail };

  // 3. Rapid-fire requests (100/sec)
  let rapidSuccess = 0, rapidFail = 0;
  const rapidKeys = Array.from({ length: 100 }, () => uuidv4());
  await Promise.all(rapidKeys.map(async (key) => {
    try {
      await prisma.$executeRaw`SELECT open_box(${user.id}, ${box.id}, ${key})`;
      rapidSuccess++;
    } catch {
      rapidFail++;
    }
  }));
  report.rapidFire = { success: rapidSuccess, fail: rapidFail };

  // 4. Wallet manipulation attempts
  let walletManipSuccess = 0, walletManipFail = 0;
  try {
    await prisma.wallet.update({ where: { userId: user.id }, data: { cashBalance: new Prisma.Decimal(99999999) } });
    walletManipSuccess++;
  } catch {
    walletManipFail++;
  }
  report.walletManipulation = { success: walletManipSuccess, fail: walletManipFail };

  // 5. Referral farming bots
  let referralSuccess = 0, referralFail = 0;
  for (let i = 0; i < 10; ++i) {
    const bot = await prisma.user.create({ data: { platformId: `refbot${i}` } });
    try {
      await prisma.referralLog.create({
        data: { inviterId: user.id, referredUserId: bot.id, ip: `1.2.3.${i}` },
      });
      referralSuccess++;
    } catch {
      referralFail++;
    }
  }
  report.referralFarming = { success: referralSuccess, fail: referralFail };

  // Output report
  console.log("Attack Simulation Report:", JSON.stringify(report, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
