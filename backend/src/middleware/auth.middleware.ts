import jwt from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { getErrorStatus, structuredError } from "../utils/apiResponse";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(getErrorStatus("UNAUTHORIZED")).json(structuredError("UNAUTHORIZED", "Unauthorized"));
  }

  const token = authHeader.slice("Bearer ".length).trim();

  if (!token) {
    return res.status(getErrorStatus("UNAUTHORIZED")).json(structuredError("UNAUTHORIZED", "Unauthorized"));
  }

  const secret = env.JWT_SECRET;

  if (!secret) {
    return res.status(getErrorStatus("INTERNAL_ERROR")).json(structuredError("INTERNAL_ERROR", "Auth is not configured"));
  }

  try {
    const payload = jwt.verify(token, secret) as { userId?: string };

    if (!payload?.userId || !payload.userId.trim()) {
      return res.status(getErrorStatus("UNAUTHORIZED")).json(structuredError("UNAUTHORIZED", "Unauthorized"));
    }

    (req as Request & { userId?: string }).userId = payload.userId;
    return next();
  } catch {
    return res.status(getErrorStatus("UNAUTHORIZED")).json(structuredError("UNAUTHORIZED", "Unauthorized"));
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(getErrorStatus('UNAUTHORIZED')).json(structuredError('UNAUTHORIZED', 'Unauthorized'));
  }
  const token = authHeader.split(' ')[1];
  const secret = env.JWT_SECRET;
  if (!secret) {
    return res.status(getErrorStatus('INTERNAL_ERROR')).json(structuredError('INTERNAL_ERROR', 'Auth is not configured'));
  }
  try {
    const payload = jwt.verify(token, secret) as { userId?: string; role?: string };
    if (payload.role !== 'admin') {
      return res.status(getErrorStatus('FORBIDDEN')).json(structuredError('FORBIDDEN', 'Forbidden: Admins only'));
    }
    (req as any).user = payload;
    next();
  } catch {
    return res.status(getErrorStatus('UNAUTHORIZED')).json(structuredError('UNAUTHORIZED', 'Invalid token'));
  }
}
