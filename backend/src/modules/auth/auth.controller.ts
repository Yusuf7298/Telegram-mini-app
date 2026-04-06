import { Request, Response } from "express";
import { authWithTelegram, generateToken } from "./auth.service";
import { verifyTelegramData } from "./telegramAuth";
import { AlertService } from "../../services/alert.service";

  try {
    const { initData } = req.body as { initData?: string };
    if (typeof initData !== "string" || !initData.trim()) {
      return res.status(400).json({ success: false, error: "initData is required" });
    }

    // Track failed attempts by IP in-memory (could use Redis for distributed)
    const ip = req.ip;
    const failKey = `tgfail:${ip}`;
    if (!global.__tgFailCounts) global.__tgFailCounts = {};
    const failCounts = global.__tgFailCounts;

    try {
      verifyTelegramData(initData);
      // Reset fail count on success
      if (failCounts[failKey]) failCounts[failKey] = 0;
    } catch (authErr: unknown) {
      failCounts[failKey] = (failCounts[failKey] || 0) + 1;
      if (failCounts[failKey] > 3) {
        await AlertService.failedTelegramAuth(null, ip, failCounts[failKey]);
      }
      const authMessage = authErr instanceof Error ? authErr.message : "Invalid Telegram data";
      return res.status(401).json({ success: false, error: authMessage });
    }

    const user = await authWithTelegram(initData);
    const token = generateToken(user.id);

    return res.json({
      success: true,
      data: {
        token,
        user,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Auth failed";
    return res.status(500).json({ success: false, error: message });
  }
}
