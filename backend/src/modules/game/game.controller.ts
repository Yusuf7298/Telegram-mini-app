import { Request, Response } from "express";
import { getBoxes, openBox, openFreeBox } from "./game.service";
import { successResponse, errorResponse } from "../../utils/apiResponse";

function getRequestUserId(req: Request): string | undefined {
  return (req as Request & { userId?: string }).userId;
}

export async function openBoxController(req: Request, res: Response) {
  try {
    const { boxId, idempotencyKey } = req.body;
    const userId = getRequestUserId(req);

    if (!userId) {
      return res.status(400).json(errorResponse("userId is required"));
    }

    if (!boxId) {
      return res.status(400).json(errorResponse("boxId is required"));
    }

    if (!idempotencyKey) {
      return res.status(400).json(errorResponse("idempotencyKey is required"));
    }

    const reward = await openBox(userId, boxId, idempotencyKey, req.ip, req.headers["x-device-id"] as string | undefined);
    return res.json(successResponse(reward));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    return res.status(400).json(errorResponse(message));
  }
}

export async function freeBoxController(req: Request, res: Response) {
  try {
    const userId = getRequestUserId(req);
    const { idempotencyKey } = req.body;

    if (!userId) {
      return res.status(400).json(errorResponse("userId is required"));
    }

    if (!idempotencyKey) {
      return res.status(400).json(errorResponse("idempotencyKey is required"));
    }

    const freeBoxResult = await openFreeBox(
      userId,
      idempotencyKey,
      req.ip,
      req.headers["x-device-id"] as string | undefined
    );
    return res.json(successResponse(freeBoxResult));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    return res.status(400).json(errorResponse(message));
  }
}

export async function getBoxesController(_req: Request, res: Response) {
  try {
    const boxes = await getBoxes();
    return res.json(successResponse(boxes));
  } catch {
    return res.status(500).json(errorResponse("Failed to load boxes"));
  }
}