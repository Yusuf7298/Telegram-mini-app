-- Missing base migration for GameConfig.
-- This restores the migration chain so later config-altering migrations can replay cleanly.

CREATE TABLE IF NOT EXISTS "GameConfig" (
  "id" TEXT NOT NULL,
  CONSTRAINT "GameConfig_pkey" PRIMARY KEY ("id")
);
