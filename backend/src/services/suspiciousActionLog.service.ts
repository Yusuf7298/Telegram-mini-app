// NEW: SuspiciousActionLog service
import { prisma } from "../config/db";
import { Prisma } from "@prisma/client";
import { AlertService } from "./alert.service";

const RISK_THRESHOLD = 5;

export async function logSuspiciousAction({
  userId,
  type,
  metadata,
  tx,
}: {
  userId: string;
  type: string;
  metadata?: any;
  tx?: Prisma.TransactionClient;
}) {
  const client = tx || prisma;
  await client.suspiciousActionLog.create({
    data: {
      userId,
      action: type,
      details: metadata ? JSON.stringify(metadata) : undefined,
    },
  });
  // Risk scoring: count recent suspicious actions
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h
  const recent = await client.suspiciousActionLog.count({
    where: { userId, createdAt: { gte: since } },
  });
  if (recent >= RISK_THRESHOLD) {
    // Auto-freeze account
    await client.user.update({ where: { id: userId }, data: { isFrozen: true } });
    // Alert admin (log to audit)
    await client.adminAuditLog.create({
      data: {
        action: "auto_freeze",
        entity: "User",
        entityId: userId,
        data: { reason: "Suspicious activity threshold exceeded", recent },
      },
    });
  }
}

// Detection helpers (to be called from business logic)
  const client = tx || prisma;
  const since = new Date(Date.now() - 60 * 1000); // last 1 min
  const count = await client.boxOpenLog.count({ where: { userId, createdAt: { gte: since } } });
  if (count > 20) {
    await AlertService.rapidBoxOpens(userId, count);
  } else if (count > 5) {
    await logSuspiciousAction({ userId, type: "rapid_box_opening", metadata: { count }, tx });
  }
}

export async function detectRepeatedWins(userId: string, tx?: Prisma.TransactionClient) {
  const client = tx || prisma;
  const last20 = await client.boxOpen.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const winCount = last20.filter(b => b.rewardAmount.gt(0)).length;
  if (winCount / last20.length > 0.8) {
    await logSuspiciousAction({ userId, type: "repeated_wins_pattern", metadata: { winCount, total: last20.length }, tx });
  }
}

  const client = tx || prisma;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days
  const count = await client.referralLog.count({ where: { referrerId: userId, createdAt: { gte: since } } });
  if (count > 10) {
    await AlertService.referralFarming(userId, count);
  }
}

  const client = tx || prisma;
  const since = new Date(Date.now() - 60 * 60 * 1000); // last 1 hour
  const txs = await client.transaction.findMany({
    where: { userId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const changes = txs.map(t => t.amount.abs().toNumber());
  const totalChange = changes.reduce((a, b) => a + b, 0);
  if (totalChange > 10000) { // e.g., ₦10,000 in 1 hour
    await AlertService.walletAnomaly(userId, totalChange);
  }
}
