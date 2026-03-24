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

  await tx.wallet.update({
    where: { userId },
    data: { cashBalance: { increment: amount } },
  });

  const walletAfterCredit = await tx.wallet.findUnique({ where: { userId } });

  if (!walletAfterCredit) {
    throw new Error("Wallet not found");
  }

  await tx.transaction.create({
    data: {
      userId,
      type: "BOX_REWARD",
      amount,
      balanceBefore: wallet.cashBalance,
      balanceAfter: walletAfterCredit.cashBalance,
    },
  });
}