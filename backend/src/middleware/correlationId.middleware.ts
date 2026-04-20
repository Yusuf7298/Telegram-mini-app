import { NextFunction, Request, Response } from "express";
import crypto from "crypto";
import { runWithRequestContext } from "../services/requestContext.service";

function resolveCorrelationId(req: Request): string {
  const headerValue = req.headers["x-correlation-id"];
  const normalizedHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const candidate = typeof normalizedHeader === "string" ? normalizedHeader.trim() : "";

  if (candidate) {
    return candidate;
  }

  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `corr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = resolveCorrelationId(req);

  req.correlationId = correlationId;
  res.setHeader("X-Correlation-Id", correlationId);

  runWithRequestContext(
    {
      correlationId,
      requestMethod: req.method,
      requestPath: req.originalUrl,
    },
    () => {
      next();
    }
  );
}
