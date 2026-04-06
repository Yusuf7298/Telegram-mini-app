"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimVault = claimVault;
exports.getUserVaultProgress = getUserVaultProgress;
const db_1 = require("../../config/db");
async function claimVault(userId, vaultId) {
    return db_1.prisma.$transaction(async (tx) => {
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
        if (!vault)
            throw new Error("Vault missing");
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
async function getUserVaultProgress(userId) {
    return db_1.prisma.userVault.findMany({
        where: { userId },
        include: { vault: true },
    });
}
