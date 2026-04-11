// NEW: Referral protection service
import { prisma } from "../config/db";
import { Prisma } from "@prisma/client";

const MAX_REFERRALS_PER_IP_PER_DAY = 5;

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
  referrerId,
  referredId,
  tx,
}: {
  ip: string;
  deviceId?: string;
  referrerId?: string;
  referredId?: string;
  tx?: Prisma.TransactionClient;
}) {
  const client = tx || prisma;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const countByIp = await client.referralLog.count({
    where: {
      ip,
      createdAt: { gte: since },
    },
  });

  if (countByIp >= MAX_REFERRALS_PER_IP_PER_DAY) {
    return false;
  }

  if (referrerId && referredId) {
    const [referrer, referred] = await Promise.all([
      client.user.findUnique({ where: { id: referrerId }, select: { deviceHash: true, createdIp: true } }),
      client.user.findUnique({ where: { id: referredId }, select: { deviceHash: true, createdIp: true } }),
    ]);

    if (!referrer || !referred) return false;
    if (referrer.createdIp === referred.createdIp) return false;
    if (referrer.deviceHash && referred.deviceHash && referrer.deviceHash === referred.deviceHash) {
      return false;
    }
  }

  if (deviceId) {
    const countByDevice = await client.referralLog.count({
      where: {
        deviceId,
        createdAt: { gte: since },
      },
    });
    if (countByDevice >= MAX_REFERRALS_PER_IP_PER_DAY) {
      return false;
    }
  }

  return true;
}
