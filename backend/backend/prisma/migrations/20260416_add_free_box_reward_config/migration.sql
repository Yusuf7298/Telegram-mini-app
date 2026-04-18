-- Add configurable free-box reward amount.
ALTER TABLE "GameConfig"
  ADD COLUMN IF NOT EXISTS "freeBoxRewardAmount" DECIMAL(10,2) NOT NULL DEFAULT 200;
