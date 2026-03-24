import { Request, Response } from "express";
import { prisma } from "../../config/db";

export async function getWallet(req: Request, res: Response) {
  try {
    const { userId } = req.params;

    if (typeof userId !== "string" || !userId.trim()) {
      return res.status(400).json({ error: "userId is required" });
    }

    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    res.json(wallet);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch wallet" });
  }
}