import { Request, Response } from "express";
import { prisma } from "../../config/db";
import { failure, success } from "../../utils/responder";

type AuthenticatedRequest = Request & { userId?: string };
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