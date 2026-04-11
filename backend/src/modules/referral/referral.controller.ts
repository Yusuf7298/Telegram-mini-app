import { Request, Response } from "express";
import { prisma } from "../../config/db";
import { logReferral, checkReferralLimits } from "../../services/referral.service";
import { logSuspiciousAction } from "../../services/suspiciousActionLog.service";
import { successResponse, errorResponse } from "../../utils/apiResponse";

function getRequestUserId(req: Request): string | undefined {
  return (req as Request & { userId?: string }).userId;
}

export async function getReferralCode(req: Request, res: Response) {
  try {
    const userId = getRequestUserId(req);
    if (!userId) return res.status(401).json(errorResponse("Unauthorized"));

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json(errorResponse("User not found"));

    return res.json(successResponse({ referralCode: user.referralCode }));
  } catch {
    return res.status(500).json(errorResponse("Failed to get referral code"));
  }
}

export async function useReferralCode(req: Request, res: Response) {
  try {
    const userId = getRequestUserId(req);
    const { referralCode, deviceId } = req.body;
    const ip = req.ip || "unknown";

    if (!userId || !referralCode) {
      return res.status(400).json(errorResponse("Missing user or referral code"));
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json(errorResponse("User not found"));
    if (user.referralCode === referralCode) return res.status(400).json(errorResponse("Cannot refer yourself"));
    if (user.referredById) return res.status(400).json(errorResponse("Referral already used"));

    const referrer = await prisma.user.findFirst({ where: { referralCode } });
    if (!referrer) return res.status(404).json(errorResponse("Invalid referral code"));

    const existingLog = await prisma.referralLog.findUnique({
      where: { referrerId_referredId: { referrerId: referrer.id, referredId: user.id } },
    });
    if (existingLog) return res.status(400).json(errorResponse("Duplicate referral"));

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
      return res.status(429).json(errorResponse("Referral limit exceeded. Try again later."));
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        referredBy: { connect: { id: referrer.id } },
        referralRewardPending: true,
        referralActivityMet: false,
      },
    });

    return res.json(successResponse({}));
  } catch {
    return res.status(500).json(errorResponse("Failed to use referral code"));
  }
}
