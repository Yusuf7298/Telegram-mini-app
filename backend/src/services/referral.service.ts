// NEW: Referral protection service
import { prisma } from "../config/db";
import { Prisma } from "@prisma/client";

const MAX_REFERRALS_PER_IP_PER_DAY = 3;

export async function logReferral({
  referrerId,
  referredId,
  ip,
  deviceId,
  suspicious,
  tx,
}: {
  referrerId: string;
  referredId: string;
  ip: string;
  deviceId?: string;
  suspicious?: boolean;
  tx?: Prisma.TransactionClient;
}) {
  const client = tx || prisma;
  await client.referralLog.create({
    data: { referrerId, referredId, ip, deviceId, suspicious: !!suspicious },
  });
}

export async function checkReferralLimits({
  ip,
  deviceId,
  tx,
}: {
  ip: string;
  deviceId?: string;
  tx?: Prisma.TransactionClient;
}) {
  const client = tx || prisma;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await client.referralLog.count({
    where: {
      ip,
      deviceId,
      createdAt: { gte: since },
    },
  });
  return count < MAX_REFERRALS_PER_IP_PER_DAY;
}
