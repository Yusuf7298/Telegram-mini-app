import { Request, Response } from "express";
import { prisma } from "../../config/db";
import { randomUUID } from "crypto";
import crypto from "crypto";

type AuthenticatedRequest = Request & { userId?: string };

function isValidString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function registerUser(req: Request, res: Response) {
  try {
    const { platformId, username, referrerId } = req.body;

    if (!isValidString(platformId)) {
      return res.status(400).json({ success: false, error: "platformId is required" });
    }

    const normalizedReferrerId = isValidString(referrerId)
      ? referrerId
      : null;

    if (normalizedReferrerId) {
      const referrer = await prisma.user.findUnique({
        where: { id: normalizedReferrerId },
        select: { id: true },
      });

      if (!referrer) {
        return res.status(400).json({ success: false, error: "Invalid referrerId" });
      }
    }

    const existing = await prisma.user.findUnique({
      where: { platformId },
    });

    if (existing) return res.json({ success: true, data: existing });

    const user = await prisma.user.create({
      data: {
        platformId,
        username: isValidString(username) ? username : null,
        referralCode: `REF-${randomUUID().replace(/-/g, "").slice(0, 12)}`,
        referredById: normalizedReferrerId,
        deviceHash: crypto.createHash("sha256").update(`${req.ip || "unknown"}|${req.headers["user-agent"] || ""}|${platformId}`).digest("hex"),
        createdIp: req.ip || "unknown",
        lastLoginIp: req.ip || "unknown",
        waitlistBonusEligible: false,
        waitlistBonusGranted: false,
        waitlistBonusUnlocked: false,
        totalPlaysCount: 0,
        wallet: {
          create: {
            bonusBalance: 0,
            bonusLocked: true,
          },
        },
      },
    });

    return res.json({ success: true, data: user });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Failed to create user" });
  }
}

export async function getReferrals(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;

    if (!userId?.trim()) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referrals: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    return res.json({ success: true, data: user });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Failed to fetch referrals" });
  }
}

export async function getCurrentUser(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;

    if (!userId?.trim()) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    return res.json({ success: true, data: user });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Failed to fetch user" });
  }
}