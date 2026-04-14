import { Request, Response } from "express";
import { prisma } from "../../config/db";
import { logReferral, checkReferralLimits } from "../../services/referral.service";
import { logSuspiciousAction } from "../../services/suspiciousActionLog.service";
import { failure, success } from "../../utils/responder";

function getRequestUserId(req: Request): string | undefined {
  return (req as Request & { userId?: string }).userId;
}

export async function getReferralCode(req: Request, res: Response) {
  try {
    const userId = getRequestUserId(req);
    if (!userId) return failure(res, "UNAUTHORIZED", "Unauthorized");

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return failure(res, "NOT_FOUND", "User not found");

    return success(res, { referralCode: user.referralCode });
  } catch {
    return failure(res, "INTERNAL_ERROR", "Failed to get referral code");
  }
}

export async function useReferralCode(req: Request, res: Response) {
  try {
    const userId = getRequestUserId(req);
    const { referralCode, deviceId } = req.body;
    const ip = req.ip || "unknown";

    if (!userId || !referralCode) {
      return failure(res, "INVALID_INPUT", "Missing user or referral code");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return failure(res, "NOT_FOUND", "User not found");
    if (user.referralCode === referralCode) return failure(res, "INVALID_INPUT", "Cannot refer yourself");
    if (user.referredById) return failure(res, "INVALID_INPUT", "Referral already used");

    const referrer = await prisma.user.findFirst({ where: { referralCode } });
    if (!referrer) return failure(res, "NOT_FOUND", "Invalid referral code");

    const existingLog = await prisma.referralLog.findUnique({
      where: { referrerId_referredId: { referrerId: referrer.id, referredId: user.id } },
    });
    if (existingLog) return failure(res, "INVALID_INPUT", "Duplicate referral");

    const safeDeviceId = deviceId || "unknown";
    const allowed = await checkReferralLimits({
      ip,
      deviceId: safeDeviceId,
      referrerId: referrer.id,
      referredId: user.id,
    });

    await logReferral({
      referrerId: referrer.id,
      referredId: user.id,
      ip,
      deviceId: safeDeviceId,
      suspicious: !allowed,
    });

    if (!allowed) {
      await logSuspiciousAction({
        userId,
        type: "referral_fraud",
        metadata: { referrerId: referrer.id, ip, deviceId: safeDeviceId },
      });
      return failure(res, "RATE_LIMIT", "Referral limit exceeded. Try again later.");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        referredBy: { connect: { id: referrer.id } },
        referralRewardPending: true,
        referralActivityMet: false,
      },
    });

    return success(res, {});
  } catch {
    return failure(res, "INTERNAL_ERROR", "Failed to use referral code");
  }
}
