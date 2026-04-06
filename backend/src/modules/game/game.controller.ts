import { Request, Response } from "express";
import { getBoxes, openBox, openFreeBox } from "./game.service";
import { successResponse, errorResponse } from "../../utils/apiResponse";

  try {
    const { boxId, idempotencyKey } = req.body;
    const userId = req.userId;
    if (!userId) {
      return res.status(400).json(errorResponse("userId is required"));
    }
    if (!boxId) {
      return res.status(400).json(errorResponse("boxId is required"));
    }
    if (!idempotencyKey) {
      return res.status(400).json(errorResponse("idempotencyKey is required"));
    }
    const reward = await openBox(userId, boxId, idempotencyKey);
    return res.json(successResponse(reward));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    return res.status(400).json(errorResponse(message));
  }
}

  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(400).json(errorResponse("userId is required"));
    }
    const reward = await openFreeBox(userId);
    return res.json(successResponse({ reward }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    return res.status(400).json(errorResponse(message));
  }
}

  try {
    const boxes = await getBoxes();
    return res.json(successResponse(boxes));
  } catch {
    return res.status(500).json(errorResponse("Failed to load boxes"));
  }
}