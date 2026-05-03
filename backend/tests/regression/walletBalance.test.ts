import type { Transaction } from '@prisma/client';
import { prisma } from '../../src/config/db';

describe('Wallet Balance', () => {
  it('should match sum of transactions', async () => {
    const userId = 'test-user-2';
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    const txs = await prisma.transaction.findMany({ where: { userId } });
    const sum = txs.reduce((acc: number, tx: Pick<Transaction, 'amount'>) => acc + Number(tx.amount), 0);
    const walletTotal = wallet ? Number(wallet.cashBalance) + Number(wallet.bonusBalance) : 0;
    expect(walletTotal).toBe(sum);
  });
});
