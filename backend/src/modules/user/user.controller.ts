import { Request, Response } from "express";
import { prisma } from "../../config/db";
import { randomUUID } from "crypto";
import crypto from "crypto";
import { failure, success } from "../../utils/responder";

type AuthenticatedRequest = Request & { userId?: string };

function isValidString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function registerUser(req: Request, res: Response) {
  try {
    const { platformId, username, referrerId } = req.body;

    if (!isValidString(platformId)) {
      return failure(res, "INVALID_INPUT", "platformId is required");
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
        return failure(res, "INVALID_INPUT", "Invalid referrerId");
      }
    }

    const existing = await prisma.user.findUnique({
      where: { platformId },
    });

    if (existing) return success(res, existing);

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

    return success(res, user);
  } catch (err) {
    return failure(res, "INTERNAL_ERROR", "Failed to create user");
  }
}

export async function getReferrals(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;

    if (!userId?.trim()) {
      return failure(res, "INVALID_INPUT", "userId is required");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referrals: true },
    });

    if (!user) {
      return failure(res, "NOT_FOUND", "User not found");
    }

    return success(res, user);
  } catch (err) {
    return failure(res, "INTERNAL_ERROR", "Failed to fetch referrals");
  }
}

export async function getCurrentUser(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId;

    if (!userId?.trim()) {
      return failure(res, "INVALID_INPUT", "userId is required");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return failure(res, "NOT_FOUND", "User not found");
    }

    return success(res, user);
  } catch (err) {
    return failure(res, "INTERNAL_ERROR", "Failed to fetch user");
  }
}