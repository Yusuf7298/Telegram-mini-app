import { prisma } from "../../src/config/db";

type WalletIssue = {
  userId: string;
  cashBalance: string;
  bonusBalance: string;
};

type Result = {
  ok: boolean;
  details: {
    negativeWalletsSample: WalletIssue[];
    balanceMismatchSample: { userId: string; walletTotal: string; txBalanceAfter: string }[];
    checkedWallets: number;
  };
};

export async function runWalletCheck(): Promise<Result> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days for tx sampling

  // Negative balances
  const negativeWallets = await prisma.wallet.findMany({
    where: {
      OR: [{ cashBalance: { lt: 0 } }, { bonusBalance: { lt: 0 } }],
    },
    select: { userId: true, cashBalance: true, bonusBalance: true },
    take: 100,
  });

  // Sample users with recent transactions to compare latest transaction balanceAfter with wallet total
  const recentTxUsers = await prisma.transaction.findMany({
    where: { createdAt: { gte: since } },
    select: { userId: true },
    distinct: ['userId'],
    take: 200,
  });

  const userIds = recentTxUsers.map((r) => r.userId);
  const wallets = await prisma.wallet.findMany({ where: { userId: { in: userIds } }, select: { userId: true, cashBalance: true, bonusBalance: true } });

  const balanceMismatch: { userId: string; walletTotal: string; txBalanceAfter: string }[] = [];

  for (const w of wallets) {
    const lastTx = await prisma.transaction.findFirst({ where: { userId: w.userId }, orderBy: { createdAt: 'desc' }, select: { balanceAfter: true } });
    if (lastTx && w.cashBalance.plus(w.bonusBalance).toString() !== lastTx.balanceAfter.toString()) {
      balanceMismatch.push({ userId: w.userId, walletTotal: w.cashBalance.plus(w.bonusBalance).toString(), txBalanceAfter: lastTx.balanceAfter.toString() });
    }
  }

  const ok = negativeWallets.length === 0 && balanceMismatch.length === 0;

  return {
    ok,
    details: {
      negativeWalletsSample: negativeWallets.map((w) => ({ userId: w.userId, cashBalance: w.cashBalance.toString(), bonusBalance: w.bonusBalance.toString() })),
      balanceMismatchSample: balanceMismatch.slice(0, 50),
      checkedWallets: wallets.length,
    },
  };
}

if (require.main === module) {
  void runWalletCheck()
    .then((r) => {
      console.log(JSON.stringify({ script: 'wallet_check', result: r }, null, 2));
      process.exit(r.ok ? 0 : 2);
    })
    .catch((err) => {
      console.error('wallet_check error', err);
      process.exit(3);
    });
}
