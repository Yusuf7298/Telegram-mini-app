import { NextFunction, Request, Response } from "express";
import { structuredError } from "../utils/apiResponse";
import { extractIdempotencyKey } from "../utils/idempotencyKey";

export function strictIdempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  const idempotencyKey = extractIdempotencyKey(req);

  if (!idempotencyKey) {
    return res.status(400).json(structuredError("INVALID_INPUT", "idempotencyKey is required"));
  }

  return next();
}
