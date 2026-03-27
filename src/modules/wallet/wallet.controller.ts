import { Request, Response } from "express";
import { prisma } from "../../config/db";

export async function getWallet(req: Request, res: Response) {
  try {
    const userId = req.userId;

    if (typeof userId !== "string" || !userId.trim()) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }

    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      return res.status(404).json({ success: false, error: "Wallet not found" });
    }

    return res.json({ success: true, data: wallet });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Failed to fetch wallet" });
  }
}