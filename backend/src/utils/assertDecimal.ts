import { Prisma } from '@prisma/client';

export function assertDecimal(value: any, context?: string): asserts value is Prisma.Decimal {
  if (typeof value === 'number') {
    throw new Error(`[DecimalSafety] Number used for money field${context ? ` in ${context}` : ''}`);
  }
  if (!(value instanceof Prisma.Decimal)) {
    throw new Error(`[DecimalSafety] Non-Decimal value for money field${context ? ` in ${context}` : ''}`);
  }
}

// Optionally freeze Object prototype for money fields (defensive)
export function freezeMoneyObject(obj: any) {
  if (obj && typeof obj === 'object') {
    Object.freeze(obj);
  }
}
