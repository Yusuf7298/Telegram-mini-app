import { Request, Response } from "express";
import { claimVault, getUserVaultProgress } from "./vault.service";

function isValidString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function claimVaultController(req: Request, res: Response) {
  try {
    const { userId, vaultId } = req.body;

    if (!isValidString(userId) || !isValidString(vaultId)) {
      return res
        .status(400)
        .json({ success: false, error: "userId and vaultId are required" });
    }

    const reward = await claimVault(userId, vaultId);

    return res.json({ success: true, reward });
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
    const userIdParam = req.params.userId;
    const userId = Array.isArray(userIdParam) ? userIdParam[0] : userIdParam;

    if (!isValidString(userId)) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }

    const data = await getUserVaultProgress(userId);

    return res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    return res.status(500).json({ success: false, error: message });
  }
}