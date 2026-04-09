import { NextFunction, Request, Response } from "express";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const headerValue = req.headers["x-user-id"];
  const userId = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  if (!userId || !userId.trim()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.userId = userId;
  return next();
}
