import { prisma } from "../config/db";

function toDecimalString(value: unknown): string {
  if (value && typeof value === "object" && "toString" in value && typeof (value as { toString?: unknown }).toString === "function") {
    return (value as { toString: () => string }).toString();
  }

  return String(value ?? "0");
}

export async function getFraudEvents() {
  const events = await prisma.suspiciousActionLog.findMany({
    orderBy: { flaggedAt: "desc" },
    take: 100,
    include: {
      user: {
        select: {
          id: true,
          platformId: true,
          username: true,
          riskScore: true,
          accountStatus: true,
        },
      },
    },
  });

  return events.map((event) => ({
    id: event.id,
    userId: event.userId,
    user: event.user
      ? {
          id: event.user.id,
          platformId: event.user.platformId,
          username: event.user.username,
          riskScore: event.user.riskScore,
          accountStatus: event.user.accountStatus,
        }
      : null,
    action: event.action,
    details: event.details,
    flaggedAt: event.flaggedAt.toISOString(),
    reviewed: event.reviewed,
  }));
}

export async function getHighRiskUsers() {
  const users = await prisma.user.findMany({
    where: {
      riskScore: {
        gt: 0,
      },
    },
    orderBy: [
      { riskScore: "desc" },
      { createdAt: "desc" },
    ],
    include: {
      wallet: true,
    },
  });

  return users.map((user) => ({
    id: user.id,
    platformId: user.platformId,
    username: user.username,
    riskScore: user.riskScore,
    accountStatus: user.accountStatus,
    createdAt: user.createdAt.toISOString(),
    wallet: user.wallet
      ? {
          cashBalance: toDecimalString(user.wallet.cashBalance),
          bonusBalance: toDecimalString(user.wallet.bonusBalance),
          bonusLocked: user.wallet.bonusLocked,
        }
      : null,
  }));
}
