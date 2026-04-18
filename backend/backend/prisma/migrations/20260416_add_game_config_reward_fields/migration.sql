-- Add configurable reward fields to GameConfig.
ALTER TABLE "GameConfig"
  ADD COLUMN IF NOT EXISTS "minBoxReward" INTEGER NOT NULL DEFAULT 150,
  ADD COLUMN IF NOT EXISTS "maxBoxReward" INTEGER NOT NULL DEFAULT 251,
  ADD COLUMN IF NOT EXISTS "waitlistBonus" INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS "dailyRewardTable" TEXT NOT NULL DEFAULT '[100,125,150,175,200,250,300]',
  ADD COLUMN IF NOT EXISTS "dailyRewardBigWinThreshold" INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS "winHistoryBigWinThreshold" INTEGER NOT NULL DEFAULT 1000;

-- Ensure the global config row exists for findFirstOrThrow callers.
INSERT INTO "GameConfig" ("id")
VALUES ('global')
ON CONFLICT ("id") DO NOTHING;