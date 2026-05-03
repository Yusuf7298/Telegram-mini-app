-- Safe, idempotent remediation for ReferralRewardGrant drift.
-- Target guarantees:
-- 1) inviterId exists and is populated from legacy referrerId when available
-- 2) referredUserId is unique
-- 3) FKs reference User(id)
-- 4) performance index on (inviterId, createdAt)
-- 5) redundant legacy index removed

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ReferralRewardGrant'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ReferralRewardGrant'
        AND column_name = 'inviterId'
    ) THEN
      ALTER TABLE public."ReferralRewardGrant"
      ADD COLUMN "inviterId" text;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ReferralRewardGrant'
        AND column_name = 'referrerId'
    ) THEN
      EXECUTE '
        UPDATE public."ReferralRewardGrant"
        SET "inviterId" = COALESCE("inviterId", "referrerId")
        WHERE "inviterId" IS NULL
      ';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ReferralRewardGrant'
      AND column_name = 'inviterId'
      AND is_nullable = 'YES'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public."ReferralRewardGrant"
      WHERE "inviterId" IS NULL
      LIMIT 1
    ) THEN
      ALTER TABLE public."ReferralRewardGrant"
      ALTER COLUMN "inviterId" SET NOT NULL;
    END IF;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ReferralRewardGrant_referredUserId_key"
  ON public."ReferralRewardGrant" ("referredUserId");

CREATE INDEX IF NOT EXISTS "ReferralRewardGrant_inviterId_createdAt_idx"
  ON public."ReferralRewardGrant" ("inviterId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ReferralRewardGrant_inviterId_fkey'
  ) THEN
    ALTER TABLE public."ReferralRewardGrant"
      ADD CONSTRAINT "ReferralRewardGrant_inviterId_fkey"
      FOREIGN KEY ("inviterId") REFERENCES public."User"(id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;

    ALTER TABLE public."ReferralRewardGrant"
      VALIDATE CONSTRAINT "ReferralRewardGrant_inviterId_fkey";
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ReferralRewardGrant_referredUserId_fkey'
  ) THEN
    ALTER TABLE public."ReferralRewardGrant"
      ADD CONSTRAINT "ReferralRewardGrant_referredUserId_fkey"
      FOREIGN KEY ("referredUserId") REFERENCES public."User"(id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;

    ALTER TABLE public."ReferralRewardGrant"
      VALIDATE CONSTRAINT "ReferralRewardGrant_referredUserId_fkey";
  END IF;
END $$;

DROP INDEX CONCURRENTLY IF EXISTS "ReferralRewardGrant_referrerId_createdAt_idx";
