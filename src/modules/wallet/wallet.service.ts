import { prisma } from "../../config/db";
import { Prisma } from "@prisma/client";

export async function creditWallet(
  userId: string,
  amount: number,
  tx: Prisma.TransactionClient = prisma
) {
  const wallet = await tx.wallet.findUnique({ where: { userId } });

  if (!wallet) {
    throw new Error("Wallet not found");
  }

  const newBalance = wallet.cashBalance + amount;

  await tx.transaction.create({
    data: {
      userId,
      type: "CREDIT",
      amount,
      balanceBefore: wallet.cashBalance,
      balanceAfter: newBalance,
    },
  });

  await tx.wallet.update({
    where: { userId },
    data: { cashBalance: newBalance },
  });
}