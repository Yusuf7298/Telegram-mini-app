import { NextFunction, Request, Response } from "express";

type RequestWithUser = Request & {
  userId?: string;
  user?: {
    id?: string;
    userId?: string;
  };
};

function resolveUserId(req: RequestWithUser): string | null {
  if (req.userId && req.userId.trim()) return req.userId;
  if (req.user?.userId && req.user.userId.trim()) return req.user.userId;
  if (req.user?.id && req.user.id.trim()) return req.user.id;
  return null;
}

function resolveIdempotencyKey(req: Request): string | null {
  const bodyKey = typeof req.body?.idempotencyKey === "string" ? req.body.idempotencyKey : undefined;
  const headerKey = req.headers["x-idempotency-key"];
  const normalizedHeader = Array.isArray(headerKey) ? headerKey[0] : headerKey;

  return bodyKey?.trim() || normalizedHeader?.toString().trim() || null;
}

function buildAction(req: Request): string {
  return `${req.method.toUpperCase()}:${req.baseUrl}${req.path}`;
}

export function requestAuditMiddleware(req: Request, res: Response, next: NextFunction) {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const reqWithUser = req as RequestWithUser;

    const logPayload = {
      userId: resolveUserId(reqWithUser),
      route: req.originalUrl,
      action: buildAction(req),
      idempotencyKey: resolveIdempotencyKey(req),
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    };

    console.info("[RequestAudit]", JSON.stringify(logPayload));
  });

  next();
}
