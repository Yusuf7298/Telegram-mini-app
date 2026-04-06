import { Request, Response } from "express";
import { prisma } from "../../config/db";
import { logReferral, checkReferralLimits } from "../../services/referral.service";
import { successResponse, errorResponse } from "../../utils/apiResponse";

  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json(errorResponse("Unauthorized"));
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json(errorResponse("User not found"));
    return res.json(successResponse({ referralCode: user.referralCode }));
  } catch (err) {
    return res.status(500).json(errorResponse("Failed to get referral code"));
  }
}

  try {
    const userId = req.userId;
    const { referralCode, deviceId } = req.body;
    const ip = req.ip;
    if (!userId || !referralCode) return res.status(400).json(errorResponse("Missing user or referral code"));
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json(errorResponse("User not found"));
    if (user.referralCode === referralCode) return res.status(400).json(errorResponse("Cannot refer yourself"));
    if (user.referredBy) return res.status(400).json(errorResponse("Referral already used"));
    const referrer = await prisma.user.findFirst({ where: { referralCode } });
    if (!referrer) return res.status(404).json(errorResponse("Invalid referral code"));
    if (referrer.id === user.id) return res.status(400).json(errorResponse("Cannot refer yourself"));
    // Check for duplicate referral
    const existingLog = await prisma.referralLog.findUnique({ where: { referrerId_referredId: { referrerId: referrer.id, referredId: user.id } } });
    if (existingLog) return res.status(400).json(errorResponse("Duplicate referral"));
    // Check anti-fraud
    const safeIp = ip || "unknown";
    const safeDeviceId = deviceId || "unknown";
    const allowed = await checkReferralLimits({ ip: safeIp, deviceId: safeDeviceId });
    await logReferral({ referrerId: referrer.id, referredId: user.id, ip: safeIp, deviceId: safeDeviceId, suspicious: !allowed });
    if (!allowed) return res.status(429).json(errorResponse("Referral limit exceeded. Try again later."));
    // Set referredBy
    await prisma.user.update({ where: { id: user.id }, data: { referredBy: { connect: { id: referrer.id } } } });
    return res.json(successResponse({}));
  } catch (err) {
    return res.status(500).json(errorResponse("Failed to use referral code"));
  }
}
