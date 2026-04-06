import { Prisma } from '@prisma/client';
import { Response, Request, NextFunction } from 'express';

function serializeDecimals(obj: any): any {
  if (obj instanceof Prisma.Decimal) {
    return obj.toString();
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeDecimals);
  }
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = serializeDecimals(obj[key]);
      }
    }
    return result;
  }
  return obj;
}

export function decimalSerializer(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json;
  res.json = function (data: any) {
    const serialized = serializeDecimals(data);
    return originalJson.call(this, serialized);
  };
  next();
}
