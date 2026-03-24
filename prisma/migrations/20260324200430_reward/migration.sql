/*
  Warnings:

  - A unique constraint covering the columns `[userId,vaultId]` on the table `UserVault` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "BoxOpen_userId_createdAt_idx" ON "BoxOpen"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserVault_userId_claimed_idx" ON "UserVault"("userId", "claimed");

-- CreateIndex
CREATE UNIQUE INDEX "UserVault_userId_vaultId_key" ON "UserVault"("userId", "vaultId");
