import { Request, Response } from "express";
import { prisma } from "../../config/db";

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
        referredBy: normalizedReferrerId,
        wallet: { create: {} },
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