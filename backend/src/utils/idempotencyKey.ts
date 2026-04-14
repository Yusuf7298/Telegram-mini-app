import { Request } from "express";

export function extractIdempotencyKey(req: Request): string | null {
  const bodyKey = typeof req.body?.idempotencyKey === "string" ? req.body.idempotencyKey : undefined;
  const headerValue = req.headers["x-idempotency-key"];
  const headerKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const normalized = bodyKey || headerKey?.toString();

  return normalized?.trim() || null;
}