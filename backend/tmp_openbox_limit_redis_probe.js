require("dotenv").config();
const { PrismaClient, Prisma } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Redis = require("ioredis");

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  const redis = new Redis(process.env.REDIS_URL);

  try {
    const base = "http://127.0.0.1:5000/api";
    const platformId = `openbox-redis-${Date.now()}`;
    const referralCode = (`OR${crypto.randomBytes(6).toString("hex")}`).toUpperCase().slice(0, 8);

    const user = await prisma.user.create({
      data: {
        platformId,
        referralCode,
        accountStatus: "ACTIVE",
        riskScore: 0,
        waitlistBonusEligible: true,
        totalPlaysCount: 30,
        freeBoxUsed: true,
      },
    });

    await prisma.wallet.upsert({
      where: { userId: user.id },
      update: { cashBalance: new Prisma.Decimal(100000), bonusBalance: new Prisma.Decimal(0), bonusLocked: true },
      create: { userId: user.id, cashBalance: new Prisma.Decimal(100000), bonusBalance: new Prisma.Decimal(0), bonusLocked: true },
    });

    const box = await prisma.box.findFirst({ orderBy: { price: "asc" } });
    if (!box) throw new Error("No box found");

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

    const action = "POST:/api/game/open-box";
    const userActionKey = `rate:user:${user.id}:action:${action}`;
    const userGeneralKey = `rate:user:${user.id}`;
    await redis.del(userActionKey, userGeneralKey);

    const rows = [];
    for (let i = 1; i <= 12; i += 1) {
      const beforeAction = Number(await redis.get(userActionKey) || 0);
      const beforeUser = Number(await redis.get(userGeneralKey) || 0);

      const res = await fetch(`${base}/game/open-box`, {
        method: "POST",
        headers,
        body: JSON.stringify({ boxId: box.id, idempotencyKey: crypto.randomUUID(), timestamp: Date.now() }),
      });

      const afterAction = Number(await redis.get(userActionKey) || 0);
      const afterUser = Number(await redis.get(userGeneralKey) || 0);

      rows.push({ i, status: res.status, beforeAction, afterAction, beforeUser, afterUser });
      await new Promise((resolve) => setTimeout(resolve, 2100));
    }

    console.log(JSON.stringify({ userId: user.id, boxId: box.id, userActionKey, rows }, null, 2));
  } finally {
    await prisma.$disconnect();
    redis.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
