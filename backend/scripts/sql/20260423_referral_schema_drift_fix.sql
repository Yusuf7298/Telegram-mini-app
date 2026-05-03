-- Drift fix for ReferralRewardGrant/User relation constraints.
-- Safe to run multiple times (idempotent) and does not delete data.

BEGIN;

-- 1) Normalize legacy FK name on inviterId.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ReferralRewardGrant_referrerId_fkey'
      AND conrelid = 'public."ReferralRewardGrant"'::regclass
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ReferralRewardGrant_inviterId_fkey'
      AND conrelid = 'public."ReferralRewardGrant"'::regclass
  ) THEN
    ALTER TABLE public."ReferralRewardGrant"
      RENAME CONSTRAINT "ReferralRewardGrant_referrerId_fkey" TO "ReferralRewardGrant_inviterId_fkey";
  END IF;
END $$;

-- 2) Keep index naming aligned with inviterId semantics.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND n.nspname = 'public'
      AND c.relname = 'ReferralRewardGrant_referrerId_createdAt_idx'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND n.nspname = 'public'
      AND c.relname = 'ReferralRewardGrant_inviterId_createdAt_idx'
  ) THEN
    ALTER INDEX public."ReferralRewardGrant_referrerId_createdAt_idx"
      RENAME TO "ReferralRewardGrant_inviterId_createdAt_idx";
  END IF;
END $$;

-- 3) Ensure unique constraint on referredUserId exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ReferralRewardGrant_referredUserId_key'
      AND conrelid = 'public."ReferralRewardGrant"'::regclass
      AND contype = 'u'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'i'
        AND n.nspname = 'public'
        AND c.relname = 'ReferralRewardGrant_referredUserId_key'
    ) THEN
      ALTER TABLE public."ReferralRewardGrant"
        ADD CONSTRAINT "ReferralRewardGrant_referredUserId_key"
        UNIQUE USING INDEX "ReferralRewardGrant_referredUserId_key";
    ELSE
      ALTER TABLE public."ReferralRewardGrant"
        ADD CONSTRAINT "ReferralRewardGrant_referredUserId_key"
        UNIQUE ("referredUserId");
    END IF;
  END IF;
END $$;

-- 4) Ensure inviter FK exists with expected behavior.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ReferralRewardGrant_inviterId_fkey'
      AND conrelid = 'public."ReferralRewardGrant"'::regclass
      AND contype = 'f'
  ) THEN
    ALTER TABLE public."ReferralRewardGrant"
      ADD CONSTRAINT "ReferralRewardGrant_inviterId_fkey"
      FOREIGN KEY ("inviterId") REFERENCES public."User"("id")
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

-- 5) Ensure referredUser FK exists with expected behavior.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ReferralRewardGrant_referredUserId_fkey'
      AND conrelid = 'public."ReferralRewardGrant"'::regclass
      AND contype = 'f'
  ) THEN
    ALTER TABLE public."ReferralRewardGrant"
      ADD CONSTRAINT "ReferralRewardGrant_referredUserId_fkey"
      FOREIGN KEY ("referredUserId") REFERENCES public."User"("id")
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

-- 6) Ensure User self-reference FK exists for referredById.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'User_referredById_fkey'
      AND conrelid = 'public."User"'::regclass
      AND contype = 'f'
  ) THEN
    ALTER TABLE public."User"
      ADD CONSTRAINT "User_referredById_fkey"
      FOREIGN KEY ("referredById") REFERENCES public."User"("id")
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
