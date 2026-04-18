import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export type TopWinner = {
  userId: string;
  username: string;
  profilePhoto: string | null;
  totalEarnings: number;
  totalWins: number;
};

function toSafeNumber(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }

  return 0;
}

function normalizeLimit(value: number | undefined): number {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(value), MAX_LIMIT);
}

export async function getTopWinners(limitInput?: number): Promise<TopWinner[]> {
  const limit = normalizeLimit(limitInput);

  const grouped = await prisma.transaction.groupBy({
    by: ["userId"],
    where: {
      type: { in: ["BOX_REWARD", "FREE_BOX"] },
      amount: { gt: 0 },
    },
    _sum: { amount: true },
    _count: { userId: true },
    orderBy: [{ _sum: { amount: "desc" } }, { _count: { userId: "desc" } }],
    take: limit,
  });

  if (grouped.length === 0) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((entry) => entry.userId) } },
    select: {
      id: true,
      username: true,
    },
  });

  const userById = new Map(users.map((user) => [user.id, user]));

  const winners = grouped.map((entry) => {
    const user = userById.get(entry.userId);
    const username = user?.username?.trim() || `User ${entry.userId.slice(0, 6)}`;

    return {
      userId: entry.userId,
      username,
      profilePhoto: null,
      totalEarnings: toSafeNumber(entry._sum?.amount),
      totalWins: entry._count?.userId ?? 0,
    };
  });

  winners.sort((a, b) => {
    if (b.totalEarnings !== a.totalEarnings) {
      return b.totalEarnings - a.totalEarnings;
    }

    if (b.totalWins !== a.totalWins) {
      return b.totalWins - a.totalWins;
    }

    return a.username.localeCompare(b.username);
  });

  return winners;
}
