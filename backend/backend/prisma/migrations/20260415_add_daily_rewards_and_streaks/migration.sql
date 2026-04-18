-- Add DAILY_REWARD transaction enum value (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'TransactionType' AND e.enumlabel = 'DAILY_REWARD'
  ) THEN
    ALTER TYPE "TransactionType" ADD VALUE 'DAILY_REWARD';
  END IF;
END $$;

-- Add streak tracking fields to users.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "dailyRewardStreak" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastDailyRewardClaimAt" TIMESTAMP(3);
