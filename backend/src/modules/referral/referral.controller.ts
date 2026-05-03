import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import { applyReferralCode, ReferralServiceError } from "../../services/referral.service";
import { logSuspiciousAction } from "../../services/suspiciousActionLog.service";
import { failure, success } from "../../utils/responder";
import { rejectIfDbUnhealthy } from "../../middleware/dbHealthGuard.middleware";

function getRequestUserId(req: Request): string | undefined {
  return (req as Request & { userId?: string }).userId;
}
function parseRewardAmount(details: string | null): Prisma.Decimal {
  if (!details) {
    return new Prisma.Decimal(0);
  }
  try {
    const parsed = JSON.parse(details) as { rewardAmount?: unknown };
    const rewardAmount = parsed.rewardAmount;
    if (typeof rewardAmount === "string" || typeof rewardAmount === "number") {
      return new Prisma.Decimal(rewardAmount);
    }
  } catch {
    return new Prisma.Decimal(0);
  }
  return new Prisma.Decimal(0);
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
export async function getReferralList(req: Request, res: Response) {
  try {
    const userId = getRequestUserId(req);
    if (!userId) {
      return failure(res, "UNAUTHORIZED", "Unauthorized");
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        referrals: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            createdAt: true,
            referralStatus: true,
            referralRewardGrantReceived: {
              select: {
                amount: true,
              },
            },
          },
        },
      },
    });
    if (!user) {
      return failure(res, "NOT_FOUND", "User not found");
    }
    const referrals = user.referrals.map((referral) => {
      const referralStatus = referral.referralStatus;
      const rewardAmount = referral.referralRewardGrantReceived?.amount.toNumber() ?? 0;
      return {
        referredUserId: referral.id,
        referralStatus,
        rewardAmount,
        createdAt: referral.createdAt,
      };
    });
    const totals = referrals.reduce(
      (accumulator, referral) => {
        if (referral.referralStatus === "ACTIVE") {
          accumulator.activeReferrals += 1;
          accumulator.totalEarned += referral.rewardAmount;
        }
        return accumulator;
      },
      {
        activeReferrals: 0,
        totalEarned: 0,
      }
    );
    return success(res, {
      referrals,
      totals,
    });
  } catch {
    return failure(res, "INTERNAL_ERROR", "Failed to fetch referral list");
  }
}
export async function getReferralAnalytics(req: Request, res: Response) {
  try {
    const userId = getRequestUserId(req);
    if (!userId) {
      return failure(res, "UNAUTHORIZED", "Unauthorized");
    }
    const [totalReferrals, joinedCount, activeCount, referralRewards] = await Promise.all([
      prisma.user.count({
        where: {
          referredById: userId,
        },
      }),
      prisma.user.count({
        where: {
          referredById: userId,
          referralStatus: "JOINED",
        },
      }),
      prisma.user.count({
        where: {
          referredById: userId,
          referralStatus: "ACTIVE",
        },
      }),
      prisma.auditLog.findMany({
        where: {
          userId,
          action: "referral_reward",
        },
        select: {
          details: true,
        },
      }),
    ]);
    const totalRewardsDistributed = referralRewards.reduce(
      (sum, entry) => sum.add(parseRewardAmount(entry.details)),
      new Prisma.Decimal(0)
    );
    const conversionRate = joinedCount > 0 ? activeCount / joinedCount : 0;
    return success(res, {
      totalReferrals,
      joinedCount,
      activeCount,
      conversionRate,
      totalRewardsDistributed: totalRewardsDistributed.toString(),
    });
  } catch {
    return failure(res, "INTERNAL_ERROR", "Failed to fetch referral analytics");
  }
}
export async function useReferralCode(req: Request, res: Response) {
  try {
    const userId = getRequestUserId(req);
    const { referralCode, deviceId, idempotencyKey } = req.body;
    const ip = req.ip || "unknown";
    if (!userId || !referralCode || !idempotencyKey) {
      return failure(res, "INVALID_INPUT", "Missing user, referral code, or idempotencyKey");
    }
    if (await rejectIfDbUnhealthy(res)) {
      return;
    }
    const result = await applyReferralCode({
      referredUserId: userId,
      referralCode,
      ip,
      deviceId,
      idempotencyKey,
    });

    return success(res, result);
  } catch (error) {
    if (error instanceof ReferralServiceError) {
      if (error.code === "RATE_LIMIT") {
        await logSuspiciousAction({
          userId: getRequestUserId(req) || "system",
          type: "referral_fraud",
          metadata: {
            referralCode: req.body?.referralCode,
            ip: req.ip || "unknown",
            deviceId: req.body?.deviceId || "unknown",
          },
        });
      }
      return failure(res, error.code, error.message);
    }
    return failure(res, "INTERNAL_ERROR", "Failed to use referral code");
  }
}
