-- Add missing rewardTable column required by Prisma schema and seed data
ALTER TABLE "Box"
ADD COLUMN IF NOT EXISTS "rewardTable" JSONB;
