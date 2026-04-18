import { Request, Response } from "express";
import { authWithTelegram, generateToken } from "./auth.service";
import { verifyTelegramData } from "./telegramAuth";
import { AlertService } from "../../services/alert.service";
import { applyReferralCode, ReferralServiceError } from "../../services/referral.service";
import { prisma } from "../../config/db";
import { failure, success } from "../../utils/responder";

const telegramFailCounts = new Map<string, number>();

export async function telegramLogin(req: Request, res: Response) {
  try {
    const { initData, referralCode } = req.body as { initData?: string; referralCode?: string };
    if (typeof initData !== "string" || !initData.trim()) {
      return failure(res, "INVALID_INPUT", "initData is required");
    }

    // Keep lightweight per-IP failure counters to detect brute force attempts.
    const ip = req.ip || "unknown";
    const failKey = `tgfail:${ip}`;

    try {
      verifyTelegramData(initData);
      telegramFailCounts.delete(failKey);
    } catch (authErr: unknown) {
      const failedCount = (telegramFailCounts.get(failKey) || 0) + 1;
      telegramFailCounts.set(failKey, failedCount);

      if (failedCount > 3) {
        await AlertService.failedTelegramAuth(null, ip, failedCount);
      }

      const authMessage = authErr instanceof Error ? authErr.message : "Invalid Telegram data";
      return failure(res, "REPLAY_ATTACK", authMessage);
    }

    const user = await authWithTelegram(initData, {
      ip,
      deviceId: (req.headers["x-device-id"] as string | undefined) || undefined,
      userAgent: req.headers["user-agent"] as string | undefined,
    });

    const referralStatus: {
      attempted: boolean;
      applied: boolean;
      status: "not_provided" | "applied" | "already_used" | "failed";
      message?: string;
      data?: unknown;
    } = {
      attempted: false,
      applied: false,
      status: "not_provided",
    };

    const normalizedReferralCode =
      typeof referralCode === "string" && referralCode.trim() ? referralCode.trim() : undefined;

    if (normalizedReferralCode) {
      referralStatus.attempted = true;
      try {
        const referralResult = await applyReferralCode({
          referredUserId: user.id,
          referralCode: normalizedReferralCode,
          ip,
          deviceId: (req.headers["x-device-id"] as string | undefined) || undefined,
        });
        referralStatus.applied = true;
        referralStatus.status = "applied";
        referralStatus.data = referralResult;
      } catch (referralError) {
        if (
          referralError instanceof ReferralServiceError &&
          referralError.code === "INVALID_INPUT" &&
          referralError.message === "Referral already used"
        ) {
          referralStatus.status = "already_used";
          referralStatus.message = referralError.message;
        } else if (referralError instanceof ReferralServiceError) {
          return failure(res, referralError.code, referralError.message);
        } else {
          return failure(res, "INTERNAL_ERROR", "Failed to apply referral code");
        }
      }
    }

    const latestUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!latestUser) {
      return failure(res, "NOT_FOUND", "User not found");
    }

    const token = generateToken(user.id, latestUser.role);

    return success(res, {
      token,
      user: latestUser,
      referral: referralStatus,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Auth failed";
    return failure(res, "INTERNAL_ERROR", message);
  }
}
