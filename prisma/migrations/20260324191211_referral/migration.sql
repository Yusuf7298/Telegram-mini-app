-- AlterTable
ALTER TABLE "User" ADD COLUMN     "referrals" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "referredBy" TEXT;
