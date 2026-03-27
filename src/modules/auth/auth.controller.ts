import { Request, Response } from "express";
import { authWithTelegram, generateToken } from "./auth.service";
import { verifyTelegramData } from "./telegramAuth";

export async function telegramLogin(req: Request, res: Response) {
  try {
    const { initData } = req.body as { initData?: string };

    if (typeof initData !== "string" || !initData.trim()) {
      return res.status(400).json({ success: false, error: "initData is required" });
    }

    try {
      verifyTelegramData(initData);
    } catch (authErr: unknown) {
      const authMessage =
        authErr instanceof Error ? authErr.message : "Invalid Telegram data";

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
