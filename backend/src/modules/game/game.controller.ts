import { Request, Response } from "express";
import { getBoxes, openBox, openFreeBox } from "./game.service";
import { failure, success } from "../../utils/responder";
import { extractIdempotencyKey } from "../../utils/idempotencyKey";

function getRequestUserId(req: Request): string | undefined {
  return (req as Request & { userId?: string }).userId;
}

export async function openBoxController(req: Request, res: Response) {
  try {
    const { boxId } = req.body;
    const idempotencyKey = extractIdempotencyKey(req);
    const userId = getRequestUserId(req);

    if (!userId) {
      return failure(res, "INVALID_INPUT", "userId is required");
    }

    if (!boxId) {
      return failure(res, "INVALID_INPUT", "boxId is required");
    }

    if (!idempotencyKey) {
      return failure(res, "INVALID_INPUT", "idempotencyKey is required");
    }

    const replaySafeResponse = await openBox(
      userId,
      boxId,
      idempotencyKey,
      req.ip,
      req.headers["x-device-id"] as string | undefined
    ) as { success: true; data: unknown; error: null };
    return success(res, replaySafeResponse.data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    return failure(res, "INTERNAL_ERROR", message);
  }
}

export async function freeBoxController(req: Request, res: Response) {
  try {
    const userId = getRequestUserId(req);
    const idempotencyKey = extractIdempotencyKey(req);

    if (!userId) {
      return failure(res, "INVALID_INPUT", "userId is required");
    }

    if (!idempotencyKey) {
      return failure(res, "INVALID_INPUT", "idempotencyKey is required");
    }

    const freeBoxResult = await openFreeBox(
      userId,
      idempotencyKey,
      req.ip,
      req.headers["x-device-id"] as string | undefined
    ) as { success: true; data: unknown; error: null };
    return success(res, freeBoxResult.data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    return failure(res, "INTERNAL_ERROR", message);
  }
}

export async function getBoxesController(_req: Request, res: Response) {
  try {
    const boxes = await getBoxes();
    return success(res, boxes);
  } catch {
    return failure(res, "INTERNAL_ERROR", "Failed to load boxes");
  }
}