import { prisma } from "../../config/db";

export async function claimVault(userId: string, vaultId: string) {
  return prisma.$transaction(async (tx) => {
    const userVault = await tx.userVault.findUnique({
      where: {
        userId_vaultId: { userId, vaultId },
      },
    });

    if (!userVault) {
      throw new Error("Vault not found");
    }

    if (userVault.claimed) {
      throw new Error("Already claimed");
    }

    const vault = await tx.vault.findUnique({
      where: { id: vaultId },
    });

    if (!vault) throw new Error("Vault missing");

    if (userVault.progress < vault.target) {
      throw new Error("Not enough progress");
    }

    const wallet = await tx.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new Error("Wallet not found");
    }

    // credit reward
    await tx.wallet.update({
      where: { userId },
      data: { cashBalance: { increment: vault.reward } },
    });

    const walletAfterReward = await tx.wallet.findUnique({
      where: { userId },
    });

    if (!walletAfterReward) {
      throw new Error("Wallet not found");
    }

    await tx.transaction.create({
      data: {
        userId,
        type: "VAULT_REWARD",
        amount: vault.reward,
        balanceBefore: wallet.cashBalance,
        balanceAfter: walletAfterReward.cashBalance,
      },
    });

    // mark claimed
    await tx.userVault.update({
      where: { id: userVault.id },
      data: { claimed: true },
    });

    return vault.reward;
  });
}

export async function getUserVaultProgress(userId: string) {
  return prisma.userVault.findMany({
    where: { userId },
    include: { vault: true },
  });
}