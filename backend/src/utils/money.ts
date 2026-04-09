import { Prisma } from '@prisma/client';

// Create a Decimal from any value
export function D(value: any): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

// Arithmetic helpers
export function add(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.plus(b);
}
export function sub(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.minus(b);
}
export function mul(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.times(b);
}
export function div(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.div(b);
}

// Comparison helpers
export function gt(a: Prisma.Decimal, b: Prisma.Decimal): boolean {
  return a.gt(b);
}
export function gte(a: Prisma.Decimal, b: Prisma.Decimal): boolean {
  return a.gte(b);
}
export function lt(a: Prisma.Decimal, b: Prisma.Decimal): boolean {
  return a.lt(b);
}
export function lte(a: Prisma.Decimal, b: Prisma.Decimal): boolean {
  return a.lte(b);
}
export function eq(a: Prisma.Decimal, b: Prisma.Decimal): boolean {
  return a.equals(b);
}

// Serializer
export function toStr(decimal: Prisma.Decimal): string {
  return decimal.toString();
}
