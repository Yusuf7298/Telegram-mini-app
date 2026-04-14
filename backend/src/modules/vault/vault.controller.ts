import { Request, Response } from "express";
import { claimVault, getUserVaultProgress } from "./vault.service";
import { failure, success } from "../../utils/responder";

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
      return failure(res, "INVALID_INPUT", "userId and vaultId are required");
    }

    const reward = await claimVault(userId, vaultId);

    return success(res, { reward });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    return failure(res, "INVALID_INPUT", message);
  }
}

export async function getUserVaultProgressController(
  req: Request,
  res: Response
) {
  try {
    const userId = getRequestUserId(req);

    if (!isValidString(userId)) {
      return failure(res, "INVALID_INPUT", "userId is required");
    }

    const data = await getUserVaultProgress(userId);

    return success(res, data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    return failure(res, "INTERNAL_ERROR", message);
  }
}