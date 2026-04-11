// NEW: SuspiciousActionLog service
import { prisma } from "../config/db";
import { Prisma } from "@prisma/client";
import { AlertService } from "./alert.service";

const RISK_BY_TYPE: Record<string, number> = {
  multi_account_same_ip: 35,
  device_reuse: 35,
  rapid_play: 15,
  onboarding_abuse: 25,
  repeated_wins: 20,
  referral_fraud: 25,
  withdrawal_risk: 25,
};

function resolveAccountStatus(riskScore: number): "ACTIVE" | "RESTRICTED" | "FROZEN" {
  if (riskScore > 90) return "FROZEN";
  if (riskScore > 70) return "RESTRICTED";
  return "ACTIVE";
}

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
  const riskIncrement = RISK_BY_TYPE[type] ?? 10;

  await client.suspiciousActionLog.create({
    data: {
      userId,
      action: type,
      details: metadata ? JSON.stringify(metadata) : undefined,
    },
  });

  const current = await client.user.findUnique({
    where: { id: userId },
    select: { riskScore: true },
  });

  if (!current) return;

  const nextRiskScore = current.riskScore + riskIncrement;
  const nextStatus = resolveAccountStatus(nextRiskScore);

  await client.user.update({
    where: { id: userId },
    data: {
      riskScore: nextRiskScore,
      accountStatus: nextStatus,
      waitlistBonusEligible: nextRiskScore <= 50,
      isFrozen: nextStatus === "FROZEN",
    },
  });

  if (nextStatus !== "ACTIVE") {
    await client.adminAuditLog.create({
      data: {
        action: "risk_enforcement",
        entity: "User",
        entityId: userId,
        data: {
          reason: "Risk score threshold exceeded",
          type,
          riskIncrement,
          nextRiskScore,
          accountStatus: nextStatus,
        },
      },
    });
  }
}

// Detection helpers (to be called from business logic)
export async function detectRapidBoxOpening(userId: string, tx?: Prisma.TransactionClient) {
  const client = tx || prisma;
  const since = new Date(Date.now() - 60 * 1000);
  const count = await client.boxOpenLog.count({ where: { userId, createdAt: { gte: since } } });
  if (count > 20) {
    await AlertService.rapidBoxOpens(userId, count);
  } else if (count > 5) {
    await logSuspiciousAction({ userId, type: "rapid_play", metadata: { count }, tx });
  }
}

export async function detectRepeatedWins(userId: string, tx?: Prisma.TransactionClient) {
  const client = tx || prisma;
  const last20 = await client.boxOpen.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  if (last20.length < 20) return;

  const winCount = last20.filter(b => b.rewardAmount.gt(0)).length;
  if (winCount / last20.length > 0.8) {
    await client.user.update({
      where: { id: userId },
      data: {
        waitlistBonusEligible: false,
      },
    });

    await AlertService.repeatedWins(userId, winCount, last20.length);

    await logSuspiciousAction({ userId, type: "repeated_wins", metadata: { winCount, total: last20.length }, tx });
  }
}

export async function detectReferralFarming(userId: string, tx?: Prisma.TransactionClient) {
  const client = tx || prisma;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const count = await client.referralLog.count({ where: { referrerId: userId, createdAt: { gte: since } } });
  if (count > 10) {
    await AlertService.referralFarming(userId, count);
    await logSuspiciousAction({ userId, type: "referral_fraud", metadata: { count }, tx });
  }
}

export async function detectWalletAnomaly(userId: string, tx?: Prisma.TransactionClient) {
  const client = tx || prisma;
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const txs = await client.transaction.findMany({
    where: { userId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const changes = txs.map((t) => t.amount.abs().toNumber());
  const totalChange = changes.reduce((a, b) => a + b, 0);
  if (totalChange > 10000) {
    await AlertService.walletAnomaly(userId, totalChange);
    await logSuspiciousAction({ userId, type: "withdrawal_risk", metadata: { totalChange }, tx });
  }
}
