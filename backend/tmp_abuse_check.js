require("dotenv").config();
const { PrismaClient, Prisma } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const base = "http://127.0.0.1:5000/api";
    const platformId = `abuse-test-${Date.now()}`;

    let user = await prisma.user.findUnique({ where: { platformId } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          platformId,
          referralCode: (`AB${crypto.randomBytes(6).toString("hex")}`).toUpperCase().slice(0, 8),
          accountStatus: "ACTIVE",
          riskScore: 0,
          waitlistBonusEligible: true,
          totalPlaysCount: 20,
          freeBoxUsed: false,
        },
      });
    }

    await prisma.wallet.upsert({
      where: { userId: user.id },
      update: {
        cashBalance: new Prisma.Decimal(50000),
        bonusBalance: new Prisma.Decimal(0),
        bonusLocked: true,
      },
      create: {
        userId: user.id,
        cashBalance: new Prisma.Decimal(50000),
        bonusBalance: new Prisma.Decimal(0),
        bonusLocked: true,
      },
    });

    const box = await prisma.box.findFirst({ orderBy: { price: "asc" } });
    if (!box) {
      throw new Error("No box found");
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const post = (path, body) =>
      fetch(`${base}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

    const report = {
      userId: user.id,
      boxId: box.id,
      openBox10PerMin: [],
      freeBox1PerHour: [],
      withdraw3PerMin: [],
      burst2s: [],
    };

    for (let i = 0; i < 12; i += 1) {
      const res = await post("/game/open-box", {
        boxId: box.id,
        idempotencyKey: crypto.randomUUID(),
        timestamp: Date.now(),
      });
      report.openBox10PerMin.push(res.status);
      await sleep(2100);
    }

    for (let i = 0; i < 2; i += 1) {
      const res = await post("/game/free-box", {
        idempotencyKey: crypto.randomUUID(),
        timestamp: Date.now(),
      });
      report.freeBox1PerHour.push(res.status);
    }

    for (let i = 0; i < 4; i += 1) {
      const res = await post("/wallet/withdraw", {
        amount: "1",
        idempotencyKey: crypto.randomUUID(),
      });
      report.withdraw3PerMin.push(res.status);
    }

    const burstResponses = await Promise.all(
      Array.from({ length: 6 }, () =>
        post("/wallet/withdraw", {
          amount: "1",
          idempotencyKey: crypto.randomUUID(),
        })
      )
    );
    report.burst2s = burstResponses.map((r) => r.status);

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
