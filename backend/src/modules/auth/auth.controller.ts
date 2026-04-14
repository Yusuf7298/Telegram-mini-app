import { Request, Response } from "express";
import { authWithTelegram, generateToken } from "./auth.service";
import { verifyTelegramData } from "./telegramAuth";
import { AlertService } from "../../services/alert.service";
import { failure, success } from "../../utils/responder";

const telegramFailCounts = new Map<string, number>();

export async function telegramLogin(req: Request, res: Response) {
  try {
    const { initData } = req.body as { initData?: string };
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
    const token = generateToken(user.id);

    return success(res, {
      token,
      user,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Auth failed";
    return failure(res, "INTERNAL_ERROR", message);
  }
}
