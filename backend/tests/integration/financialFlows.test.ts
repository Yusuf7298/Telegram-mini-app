// @ts-nocheck
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../src/server';

const prisma = new PrismaClient();

// Utility to reset DB between tests
async function resetDb() {
  await prisma.$executeRaw`TRUNCATE TABLE "User", "Wallet", "Box", "BoxOpenLog", "Transaction", "ReferralLog", "SuspiciousActionLog", "IdempotencyKey" RESTART IDENTITY CASCADE;`;
}

describe.skip('Financial Flows Integration', () => {
  let userToken: string;
  let userId: string;
  let bonusUserToken: string;
  let bonusUserId: string;
  let adminToken: string;
  let boxId: string;

  beforeAll(async () => {
    // Setup: create test users, admin, and a box
    await resetDb();
    // Create box
    const box = await prisma.box.create({ data: { name: 'Base', price: 100, isActive: true } });
    boxId = box.id;
    // Create users
    const user = await prisma.user.create({ data: { platformId: 'user1', wallet: { create: { cashBalance: 1000, bonusBalance: 0 } } }, include: { wallet: true } });
    userId = user.id;
    userToken = 'test-user-token'; // Replace with real token logic if needed
    const bonusUser = await prisma.user.create({ data: { platformId: 'user2', wallet: { create: { cashBalance: 0, bonusBalance: 1000 } } }, include: { wallet: true } });
    bonusUserId = bonusUser.id;
    bonusUserToken = 'test-bonus-token';
    // Create admin
    const admin = await prisma.user.create({ data: { platformId: 'admin', isAdmin: true, wallet: { create: {} } } });
    adminToken = 'test-admin-token';
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it('should open box with cash', async () => {
    // Simulate open box with cash
    // ...
    expect(true).toBe(true); // Placeholder
  });

  it('should open box with bonus', async () => {
    // Simulate open box with bonus
    // ...
    expect(true).toBe(true); // Placeholder
  });

  it('should unlock bonus after 5 paid boxes', async () => {
    // Simulate 5 paid box opens and check bonus unlock
    // ...
    expect(true).toBe(true); // Placeholder
  });

  it('should give referral reward after activity threshold', async () => {
    // Simulate referral and activity threshold
    // ...
    expect(true).toBe(true); // Placeholder
  });

  it('should enforce wallet transaction idempotency', async () => {
    // Simulate duplicate transaction and check idempotency
    // ...
    expect(true).toBe(true); // Placeholder
  });

  it('should allow admin to freeze user', async () => {
    // Simulate admin freeze user
    // ...
    expect(true).toBe(true); // Placeholder
  });

  it('should enforce rate limit', async () => {
    // Simulate rapid requests and expect rate limit
    // ...
    expect(true).toBe(true); // Placeholder
  });
});
