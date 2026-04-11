import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import { D } from "../utils/money";

export function calculateRTP(totalIn: Prisma.Decimal | number | string, totalOut: Prisma.Decimal | number | string) {
  const inValue = D(totalIn);
  const outValue = D(totalOut);
  if (inValue.lte(0)) return D(0);
  return outValue.div(inValue).mul(D(100)).toDecimalPlaces(2);
}

export async function incrementBoxesOpened(tx?: Prisma.TransactionClient) {
  const client = tx || prisma;
  await client.systemStats.upsert({
    where: { id: "global" },
    update: { totalBoxesOpened: { increment: 1 } },
    create: {
      id: "global",
      totalIn: D(0),
      totalOut: D(0),
      totalBoxesOpened: 1,
      jackpotWins: 0,
    },
  });
}

export async function incrementJackpotWins(tx?: Prisma.TransactionClient) {
  const client = tx || prisma;
  await client.systemStats.upsert({
    where: { id: "global" },
    update: { jackpotWins: { increment: 1 } },
    create: {
      id: "global",
      totalIn: D(0),
      totalOut: D(0),
      totalBoxesOpened: 0,
      jackpotWins: 1,
    },
  });
}

export async function getSystemMetrics() {
  const stats = await prisma.systemStats.findUnique({ where: { id: "global" } });
  const totalIn = stats?.totalIn ?? D(0);
  const totalOut = stats?.totalOut ?? D(0);

  return {
    totalIn: totalIn.toString(),
    totalOut: totalOut.toString(),
    rtp: calculateRTP(totalIn, totalOut).toString(),
    totalBoxesOpened: stats?.totalBoxesOpened ?? 0,
    jackpotWins: stats?.jackpotWins ?? 0,
  };
}

export async function verifySystemIntegrity() {
  const issues: string[] = [];
  const wallets = await prisma.wallet.findMany();
  const negativeWallets = wallets.filter((wallet) => wallet.cashBalance.lt(0) || wallet.bonusBalance.lt(0));

  if (negativeWallets.length > 0) {
    issues.push(`Negative wallet balances found for userIds: ${negativeWallets.map((wallet) => wallet.userId).join(", ")}`);
  }

  const metrics = await getSystemMetrics();
  const rtp = Number(metrics.rtp);
  if (Number.isFinite(rtp) && (rtp < 0 || rtp > 100)) {
    issues.push(`RTP out of range: ${metrics.rtp}%`);
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export async function checkStatsIntegrity() {
  return verifySystemIntegrity();
}
