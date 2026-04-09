import { assertDecimal } from '../utils/assertDecimal';
// NEW: Bonus usage tracking service
import { prisma } from "../config/db";
import { Prisma } from "@prisma/client";

export async function trackBonusUsage({
  userId,
  bonusType,
  amount,
  tx,
}: {
  userId: string;
  bonusType: string;
  amount: Prisma.Decimal;
  tx?: Prisma.TransactionClient;
}) {
  const client = tx || prisma;
  assertDecimal(amount, 'bonus.amount');
  await client.bonusUsage.create({
    data: { userId, bonusType, amount },
  });
}
