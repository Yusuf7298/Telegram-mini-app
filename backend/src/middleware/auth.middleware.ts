import jwt from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const token = authHeader.slice("Bearer ".length).trim();

  if (!token) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return res.status(500).json({ success: false, error: "Auth is not configured" });
  }

  try {
    const payload = jwt.verify(token, secret) as { userId?: string };

    if (!payload?.userId || !payload.userId.trim()) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    req.userId = payload.userId;
    return next();
  } catch {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Auth is not configured' });
  }
  try {
    const payload = jwt.verify(token, secret) as { userId?: string; role?: string };
    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admins only' });
    }
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
