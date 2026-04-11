// @ts-nocheck
process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@localhost:5432/upworks_test';

import { prisma } from '../../config/db';
import { D } from '../../utils/money';
import { Prisma } from '@prisma/client';

describe.skip('Wallet Safety', () => {
  let userId: string;
  let adminId: string;
  let walletService: any;

  beforeAll(async () => {
    walletService = await import('./wallet.service');
    // Use a test DB and clean up
    await prisma.$executeRaw`TRUNCATE "User", "Wallet", "Transaction", "BonusUsage", "RewardRevocation" RESTART IDENTITY CASCADE`;
    const user = await prisma.user.create({ data: { platformId: 'testuser1', referralCode: 'REFTESTUSER1' } });
    userId = user.id;
    await prisma.wallet.create({ data: { userId, cashBalance: D(1000), bonusBalance: D(0) } });
    const admin = await prisma.user.create({ data: { platformId: 'admin1', referralCode: 'REFADMIN0001' } });
    adminId = admin.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Prevent negative balance', async () => {
    await expect(walletService.withdrawWallet(userId, D(2000))).rejects.toThrow(/Insufficient cash balance/);
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    expect(wallet?.cashBalance.gte(0)).toBe(true);
  });

  test('Concurrent deduction safety', async () => {
    await prisma.wallet.update({ where: { userId }, data: { cashBalance: D(1000) } });
    const tasks = [
      walletService.withdrawWallet(userId, D(700)),
      walletService.withdrawWallet(userId, D(700)),
    ];
    const results = await Promise.allSettled(tasks);
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    // Only one should succeed, one should fail
    expect(results.filter(r => r.status === 'fulfilled').length).toBe(1);
    expect(wallet?.cashBalance.gte(0)).toBe(true);
  });

  test('Transaction log correctness', async () => {
    await prisma.wallet.update({ where: { userId }, data: { cashBalance: D(1000) } });
    await walletService.withdrawWallet(userId, D(200));
    const txs = await prisma.transaction.findMany({ where: { userId } });
    expect(txs.some(tx => tx.amount.equals(D(-200)))).toBe(true);
  });

  test('Admin revoke safety', async () => {
    // Simulate a reward, then revoke
    await prisma.wallet.update({ where: { userId }, data: { cashBalance: D(1000) } });
    const { assertDecimal } = require('../../utils/assertDecimal');
    assertDecimal(D(100), 'test.amount');
    assertDecimal(D(1000), 'test.balanceBefore');
    assertDecimal(D(1100), 'test.balanceAfter');
    const tx = await prisma.transaction.create({
      data: {
        userId,
        type: 'BOX_REWARD',
        amount: D(100),
        balanceBefore: D(1000),
        balanceAfter: D(1100),
      },
    });
    await prisma.wallet.update({ where: { userId }, data: { cashBalance: D(1100) } });
    const { revokeReward } = require('../../services/admin.service');
    await revokeReward(tx.id, 'test', prisma);
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    expect(wallet?.cashBalance.equals(D(1000))).toBe(true);
  });

  test('Bonus usage correctness', async () => {
    await prisma.wallet.update({ where: { userId }, data: { cashBalance: D(0), bonusBalance: D(500) } });
    // Simulate bonus usage (should not allow withdrawal)
    await expect(walletService.withdrawWallet(userId, D(100))).rejects.toThrow(/Bonus cannot be withdrawn/);
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    expect(wallet?.bonusBalance.equals(D(500))).toBe(true);
  });

  test('Wallet integrity check', async () => {
    await prisma.wallet.update({ where: { userId }, data: { cashBalance: D(1000), bonusBalance: D(0) } });
    await walletService.withdrawWallet(userId, D(100));
    const ok = await walletService.checkWalletIntegrity(userId);
    expect(ok).toBe(true);
  });
});
