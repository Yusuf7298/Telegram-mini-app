-- Telegram identity refactor migration (idempotent)

-- Add telegram identity fields if missing.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "telegramId" TEXT,
  ADD COLUMN IF NOT EXISTS "firstName" TEXT,
  ADD COLUMN IF NOT EXISTS "lastName" TEXT,
  ADD COLUMN IF NOT EXISTS "profilePhotoUrl" TEXT;

-- Backfill telegramId from legacy platformId for existing users when absent.
UPDATE "User"
SET "telegramId" = "platformId"
WHERE "telegramId" IS NULL;

-- Ensure telegramId uniqueness for future logins.
CREATE UNIQUE INDEX IF NOT EXISTS "User_telegramId_key" ON "User"("telegramId");
