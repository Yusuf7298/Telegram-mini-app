import { Request, Response } from "express";
import { prisma } from "../../config/db";
import { applyReferralCode, ReferralServiceError } from "../../services/referral.service";
import { logSuspiciousAction } from "../../services/suspiciousActionLog.service";
import { failure, success } from "../../utils/responder";

function getRequestUserId(req: Request): string | undefined {
  return (req as Request & { userId?: string }).userId;
}

async function ensureWalletSnapshotInResponseData(payload: unknown, userId: string) {
  if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;
    if (data.walletSnapshot && typeof data.walletSnapshot === "object") {
      return payload;
    }
  }

  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: {
      cashBalance: true,
      bonusBalance: true,
    },
  });

  if (!wallet) {
    return payload;
  }

  const walletSnapshot = {
    cashBalance: wallet.cashBalance,
    bonusBalance: wallet.bonusBalance,
    airtimeBalance: 0,
  };

  if (payload && typeof payload === "object") {
    return {
      ...(payload as Record<string, unknown>),
      walletSnapshot,
    };
  }

  return { walletSnapshot };
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
      // Expose true referral lifecycle state (no collapsing)
      const status = referral.referralStatus;
      const reward = referral.referralRewardGrantReceived?.amount.toNumber() ?? 0;

      return {
        referredUserId: referral.id,
        status,
        reward,
        createdAt: referral.createdAt,
      };
    });

    const totals = referrals.reduce(
      (accumulator, referral) => {
        if (referral.status === "ACTIVE") {
          accumulator.activeReferrals += 1;
          accumulator.totalEarned += referral.reward;
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

export async function useReferralCode(req: Request, res: Response) {
  try {
    const userId = getRequestUserId(req);
    const { referralCode, deviceId } = req.body;
    const ip = req.ip || "unknown";

    if (!userId || !referralCode) {
      return failure(res, "INVALID_INPUT", "Missing user or referral code");
    }

    const result = await applyReferralCode({
      referredUserId: userId,
      referralCode,
      ip,
      deviceId,
    });

    const resultWithWalletSnapshot = await ensureWalletSnapshotInResponseData(result, userId);
    return success(res, resultWithWalletSnapshot);
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
