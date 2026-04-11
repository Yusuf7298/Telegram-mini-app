import { Request, Response } from "express";
import { claimVault, getUserVaultProgress } from "./vault.service";

function isValidString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getRequestUserId(req: Request): string | undefined {
  return (req as Request & { userId?: string }).userId;
}

export async function claimVaultController(req: Request, res: Response) {
  try {
    const { vaultId } = req.body;
    const userId = getRequestUserId(req);

    if (!isValidString(userId) || !isValidString(vaultId)) {
      return res
        .status(400)
        .json({ success: false, error: "userId and vaultId are required" });
    }

    const reward = await claimVault(userId, vaultId);

    return res.json({ success: true, data: { reward } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    return res.status(400).json({ success: false, error: message });
  }
}

export async function getUserVaultProgressController(
  req: Request,
  res: Response
) {
  try {
    const userId = getRequestUserId(req);

    if (!isValidString(userId)) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }

    const data = await getUserVaultProgress(userId);

    return res.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    return res.status(500).json({ success: false, error: message });
  }
}