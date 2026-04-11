require("dotenv").config();
const { PrismaClient, Prisma } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const base = "http://127.0.0.1:5000/api";
    const platformId = `openbox-paced-${Date.now()}`;
    const referralCode = (`OP${crypto.randomBytes(6).toString("hex")}`).toUpperCase().slice(0, 8);

    const user = await prisma.user.create({
      data: {
        platformId,
        referralCode,
        accountStatus: "ACTIVE",
        riskScore: 0,
        waitlistBonusEligible: true,
        totalPlaysCount: 20,
        freeBoxUsed: true,
      },
    });

    await prisma.wallet.upsert({
      where: { userId: user.id },
      update: {
        cashBalance: new Prisma.Decimal(100000),
        bonusBalance: new Prisma.Decimal(0),
        bonusLocked: true,
      },
      create: {
        userId: user.id,
        cashBalance: new Prisma.Decimal(100000),
        bonusBalance: new Prisma.Decimal(0),
        bonusLocked: true,
      },
    });

    const box = await prisma.box.findFirst({ orderBy: { price: "asc" } });
    if (!box) throw new Error("No box found");

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const tasks = [];
    const startedAt = Date.now();
    for (let i = 1; i <= 12; i += 1) {
      const dispatchAt = startedAt + (i - 1) * 2100;
      const delay = Math.max(0, dispatchAt - Date.now());
      tasks.push(
        (async () => {
          await wait(delay);
          const sendAt = Date.now();
          const res = await fetch(`${base}/game/open-box`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              boxId: box.id,
              idempotencyKey: crypto.randomUUID(),
              timestamp: Date.now(),
            }),
          });
          return {
            request: i,
            status: res.status,
            sentAtMs: sendAt - startedAt,
            receivedAtMs: Date.now() - startedAt,
          };
        })()
      );
    }

    const statuses = await Promise.all(tasks);
    statuses.sort((a, b) => a.request - b.request);

    console.log(JSON.stringify({ userId: user.id, boxId: box.id, statuses }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
