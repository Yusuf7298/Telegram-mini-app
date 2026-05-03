import { NextFunction, Request, Response } from "express";

function isPrismaConnectivityError(error: unknown): boolean {
  const err = error as { code?: string; message?: string; meta?: { code?: string } };
  const code = err.code ?? err.meta?.code;
  const message = String(err.message ?? "");

  return (
    code === "P1001" ||
    /connection terminated unexpectedly/i.test(message) ||
    /server closed the connection/i.test(message) ||
    /connection error/i.test(message) ||
    /timed out/i.test(message) ||
    /timeout/i.test(message)
  );
}

function buildLogContext(req: Request) {
  const correlationIdHeader = req.headers["x-correlation-id"];
  const correlationId = Array.isArray(correlationIdHeader)
    ? correlationIdHeader[0]
    : correlationIdHeader;

  return {
    method: req.method,
    path: req.originalUrl,
    correlationId: typeof correlationId === "string" ? correlationId : undefined,
    userId: (req as Request & { userId?: string }).userId ?? undefined,
  };
}

export function globalErrorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const context = buildLogContext(req);
  const isPrismaConnectivityIssue = isPrismaConnectivityError(err);
  const safeMessage = "Temporary server issue";

  console.error("Unhandled request error", {
    ...context,
    prismaConnectivityIssue: isPrismaConnectivityIssue,
    error: err,
  });

  if (res.headersSent) {
    return;
  }

  res.status(500).json({ error: safeMessage });
}
