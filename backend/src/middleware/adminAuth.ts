// NEW: Admin permission middleware
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { getErrorStatus, structuredError } from '../utils/apiResponse';

// Hardened admin auth: require admin JWT role AND secondary secret
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(getErrorStatus('FORBIDDEN')).json(structuredError('FORBIDDEN', 'Admin access required'));
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(getErrorStatus('FORBIDDEN')).json(structuredError('FORBIDDEN', 'Admin access required'));
  }

  const secret = env.JWT_SECRET;
  if (!secret) {
    return res.status(getErrorStatus('INTERNAL_ERROR')).json(structuredError('INTERNAL_ERROR', 'Auth is not configured'));
  }

  try {
    const payload = jwt.verify(token, secret) as { role?: string };
    if (payload.role !== 'ADMIN') {
      return res.status(getErrorStatus('FORBIDDEN')).json(structuredError('FORBIDDEN', 'Admin access required'));
    }
  } catch {
    return res.status(getErrorStatus('FORBIDDEN')).json(structuredError('FORBIDDEN', 'Admin access required'));
  }

  const adminSecret = env.ADMIN_SECRET;
  const providedSecret = req.headers['x-admin-secret'];
  if (!adminSecret || !providedSecret || providedSecret !== adminSecret) {
    return res.status(getErrorStatus('UNAUTHORIZED')).json(structuredError('UNAUTHORIZED', 'Secondary admin secret required'));
  }

  next();
}
