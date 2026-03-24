import { Request, Response } from "express";
import { openBox, openFreeBox } from "./game.service";

function isValidString(value: any) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function openBoxController(req: Request, res: Response) {
  try {
    const { userId, boxId } = req.body;

    if (!isValidString(userId)) {
      return res.status(400).json({
        success: false,
        error: "userId is required",
      });
    }

    if (!isValidString(boxId)) {
      return res.status(400).json({
        success: false,
        error: "boxId is required",
      });
    }

    const reward = await openBox(userId, boxId);

    return res.json({
      success: true,
      data: { reward },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Something went wrong";

    return res.status(400).json({
      success: false,
      error: message,
    });
  }
}

export async function freeBoxController(req: Request, res: Response) {
  try {
    const { userId } = req.body;

    if (!isValidString(userId)) {
      return res.status(400).json({
        success: false,
        error: "userId is required",
      });
    }

    const reward = await openFreeBox(userId);

    return res.json({
      success: true,
      data: { reward },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Something went wrong";

    return res.status(400).json({
      success: false,
      error: message,
    });
  }
}