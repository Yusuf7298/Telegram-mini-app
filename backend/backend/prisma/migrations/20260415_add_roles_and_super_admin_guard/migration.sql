-- Create role enum with backward-compatible migration path.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');
  END IF;
END $$;

-- Add role column defaulting existing records to USER.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "role" "Role" NOT NULL DEFAULT 'USER';

-- Ensure exactly one SUPER_ADMIN can exist at DB level.
CREATE UNIQUE INDEX IF NOT EXISTS "User_single_super_admin_idx"
  ON "User" (("role"))
  WHERE "role" = 'SUPER_ADMIN';

-- Add configurable referral reward amount for admin updates.
ALTER TABLE "GameConfig"
  ADD COLUMN IF NOT EXISTS "referralRewardAmount" DECIMAL(10,2) NOT NULL DEFAULT 200;
