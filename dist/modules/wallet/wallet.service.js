"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.creditWallet = creditWallet;
const db_1 = require("../../config/db");
async function creditWallet(userId, amount, tx = db_1.prisma) {
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
