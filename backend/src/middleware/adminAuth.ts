import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { prisma } from '../config/db';
import { getErrorStatus, structuredError } from '../utils/apiResponse';

type AdminRole = 'ADMIN' | 'SUPER_ADMIN';

function isAdminRole(role: unknown): role is AdminRole {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

function getProvidedAdminSecret(req: Request): string | undefined {
  const value = req.headers['x-admin-secret'];
  return typeof value === 'string' ? value : undefined;
}

export async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
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

  let userId: string | undefined;
  try {
    const payload = jwt.verify(token, secret) as { userId?: string };
    userId = payload.userId;
  } catch {
    return res.status(getErrorStatus('FORBIDDEN')).json(structuredError('FORBIDDEN', 'Admin access required'));
  }

  if (!userId) {
    return res.status(getErrorStatus('FORBIDDEN')).json(structuredError('FORBIDDEN', 'Admin access required'));
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user || !isAdminRole(user.role)) {
    return res.status(getErrorStatus('FORBIDDEN')).json(structuredError('FORBIDDEN', 'Admin access required'));
  }

  const adminSecret = env.ADMIN_SECRET;
  const providedSecret = getProvidedAdminSecret(req);
  if (!adminSecret || !providedSecret || providedSecret !== adminSecret) {
    return res.status(getErrorStatus('UNAUTHORIZED')).json(structuredError('UNAUTHORIZED', 'Secondary admin secret required'));
  }

  req.userId = user.id;
  req.user = {
    id: user.id,
    role: user.role,
  };

  return next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'SUPER_ADMIN') {
    return res.status(getErrorStatus('FORBIDDEN')).json(structuredError('FORBIDDEN', 'Super admin access required'));
  }

  return next();
}
