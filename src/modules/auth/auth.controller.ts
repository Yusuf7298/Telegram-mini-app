import { Request, Response } from "express";
import { authWithTelegram, generateToken } from "./auth.service";
import { verifyTelegramData } from "./telegramAuth";

export async function telegramLogin(req: Request, res: Response) {
  try {
    const { initData } = req.body as { initData?: string };

    if (typeof initData !== "string" || !initData.trim()) {
      return res.status(400).json({ error: "initData is required" });
    }

    if (!verifyTelegramData(initData)) {
      return res.status(401).json({ error: "Invalid Telegram data" });
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
    return res.status(500).json({ error: message });
  }
}
