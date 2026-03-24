import { prisma } from "../../config/db";

function generateReward() {
  const r = Math.random();

  if (r < 0.6) return 50;
  if (r < 0.85) return 100;
  if (r < 0.97) return 300;
  return 1000;
}

export async function openBox(userId: string, boxId: string) {
  return prisma.$transaction(async (tx) => {
    const box = await tx.box.findUnique({ where: { id: boxId } });
    if (!box) throw new Error("Box not found");

    const walletExists = await tx.wallet.findUnique({ where: { userId } });
    if (!walletExists) throw new Error("Wallet not found");

    const previousPlays = await tx.boxOpen.count({
      where: { userId },
    });

    const isFirstPlay = previousPlays === 0;

    const deductResult = await tx.wallet.updateMany({
      where: {
        userId,
        cashBalance: { gte: box.price },
      },
      data: {
        cashBalance: { decrement: box.price },
      },
    });

    if (deductResult.count === 0) {
      throw new Error("Insufficient balance");
    }

    const walletAfterDeduct = await tx.wallet.findUnique({ where: { userId } });
    if (!walletAfterDeduct) throw new Error("Wallet not found");

    await tx.transaction.create({
      data: {
        userId,
        type: "BOX_PURCHASE",
        amount: -box.price,
        balanceBefore: walletAfterDeduct.cashBalance.plus(box.price),
        balanceAfter: walletAfterDeduct.cashBalance,
      },
    });

    const reward = generateReward();

    await tx.wallet.update({
      where: { userId },
      data: { cashBalance: { increment: reward } },
    });

    const walletAfterReward = await tx.wallet.findUnique({ where: { userId } });
    if (!walletAfterReward) throw new Error("Wallet not found");

    await tx.transaction.create({
      data: {
        userId,
        type: "BOX_REWARD",
        amount: reward,
        balanceBefore: walletAfterDeduct.cashBalance,
        balanceAfter: walletAfterReward.cashBalance,
      },
    });

    await tx.boxOpen.create({
      data: {
        userId,
        boxId,
        rewardAmount: reward,
      },
    });

    const vaults = await tx.vault.findMany({
      where: { isActive: true },
    });

    for (const vault of vaults) {
      const userVault = await tx.userVault.upsert({
        where: {
          userId_vaultId: {
            userId,
            vaultId: vault.id,
          },
        },
        update: {},
        create: {
          userId,
          vaultId: vault.id,
          progress: 0,
        },
      });

      if (!userVault.claimed && userVault.progress < vault.target) {
        await tx.userVault.update({
          where: { id: userVault.id },
          data: {
            progress: { increment: 1 },
          },
        });
      }
    }

    if (isFirstPlay) {
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (user?.referredBy) {
        const consumeReferral = await tx.user.updateMany({
          where: {
            id: userId,
            referredBy: user.referredBy,
          },
          data: { referredBy: null },
        });

        if (consumeReferral.count === 1) {
          const bonus = 500;

          const refWallet = await tx.wallet.findUnique({
            where: { userId: user.referredBy },
          });

          if (refWallet) {
            await tx.wallet.update({
              where: { userId: user.referredBy },
              data: { cashBalance: { increment: bonus } },
            });

            const refWalletAfterReward = await tx.wallet.findUnique({
              where: { userId: user.referredBy },
            });

            if (!refWalletAfterReward) throw new Error("Referrer wallet not found");

            await tx.transaction.create({
              data: {
                userId: user.referredBy,
                type: "REFERRAL",
                amount: bonus,
                balanceBefore: refWallet.cashBalance,
                balanceAfter: refWalletAfterReward.cashBalance,
              },
            });

            await tx.user.update({
              where: { id: user.referredBy },
              data: {
                referrals: { increment: 1 },
              },
            });
          }
        }
      }
    }

    return reward;
  });
}

export async function openFreeBox(userId: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    const markUsed = await tx.user.updateMany({
      where: {
        id: userId,
        freeBoxUsed: false,
      },
      data: { freeBoxUsed: true },
    });

    if (markUsed.count === 0) {
      throw new Error("Free box already used");
    }

    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("Wallet not found");

    const reward = generateReward();

    await tx.wallet.update({
      where: { userId },
      data: { cashBalance: { increment: reward } },
    });

    const walletAfterReward = await tx.wallet.findUnique({ where: { userId } });
    if (!walletAfterReward) throw new Error("Wallet not found");

    await tx.transaction.create({
      data: {
        userId,
        type: "FREE_BOX",
        amount: reward,
        balanceBefore: wallet.cashBalance,
        balanceAfter: walletAfterReward.cashBalance,
      },
    });

    return reward;
  });
}