-- Safe alignment for ReferralRewardGrant without data loss.
-- 1) Rename legacy columns when present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ReferralRewardGrant' AND column_name = 'referrerId'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ReferralRewardGrant' AND column_name = 'inviterId'
  ) THEN
    ALTER TABLE public."ReferralRewardGrant" RENAME COLUMN "referrerId" TO "inviterId";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ReferralRewardGrant' AND column_name = 'rewardAmount'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ReferralRewardGrant' AND column_name = 'amount'
  ) THEN
    ALTER TABLE public."ReferralRewardGrant" RENAME COLUMN "rewardAmount" TO "amount";
  END IF;
END $$;

-- 2) Add missing required columns (safe defaults for existing rows)
ALTER TABLE public."ReferralRewardGrant"
  ADD COLUMN IF NOT EXISTS "id" text,
  ADD COLUMN IF NOT EXISTS "inviterId" text,
  ADD COLUMN IF NOT EXISTS "referredUserId" text,
  ADD COLUMN IF NOT EXISTS "amount" numeric(10,2),
  ADD COLUMN IF NOT EXISTS "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "sourceAction" text DEFAULT 'open_box_success';

-- 3) Backfill id if needed
UPDATE public."ReferralRewardGrant"
SET "id" = gen_random_uuid()::text
WHERE "id" IS NULL OR "id" = '';

-- 4) Normalize types
ALTER TABLE public."ReferralRewardGrant"
  ALTER COLUMN "amount" TYPE numeric(10,2) USING "amount"::numeric(10,2),
  ALTER COLUMN "createdAt" TYPE timestamp(3) without time zone USING "createdAt"::timestamp(3);

-- 5) Enforce not-null
ALTER TABLE public."ReferralRewardGrant"
  ALTER COLUMN "id" SET NOT NULL,
  ALTER COLUMN "inviterId" SET NOT NULL,
  ALTER COLUMN "referredUserId" SET NOT NULL,
  ALTER COLUMN "amount" SET NOT NULL,
  ALTER COLUMN "createdAt" SET NOT NULL,
  ALTER COLUMN "sourceAction" SET NOT NULL;

-- 6) Ensure primary key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ReferralRewardGrant"'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public."ReferralRewardGrant"
      ADD CONSTRAINT "ReferralRewardGrant_pkey" PRIMARY KEY ("id");
  END IF;
END $$;

-- 7) Ensure unique referredUserId
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."ReferralRewardGrant"'::regclass
      AND contype = 'u'
      AND conname = 'ReferralRewardGrant_referredUserId_key'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_class i
      JOIN pg_namespace n ON n.oid = i.relnamespace
      JOIN pg_index x ON x.indexrelid = i.oid
      JOIN pg_class t ON t.oid = x.indrelid
      WHERE n.nspname = 'public'
        AND t.relname = 'ReferralRewardGrant'
        AND i.relname = 'ReferralRewardGrant_referredUserId_key'
        AND x.indisunique = true
    ) THEN
      ALTER TABLE public."ReferralRewardGrant"
        ADD CONSTRAINT "ReferralRewardGrant_referredUserId_key"
        UNIQUE USING INDEX "ReferralRewardGrant_referredUserId_key";
    ELSE
      CREATE UNIQUE INDEX IF NOT EXISTS "ReferralRewardGrant_referredUserId_uniq_idx"
        ON public."ReferralRewardGrant"("referredUserId");
      ALTER TABLE public."ReferralRewardGrant"
        ADD CONSTRAINT "ReferralRewardGrant_referredUserId_key"
        UNIQUE USING INDEX "ReferralRewardGrant_referredUserId_uniq_idx";
    END IF;
  END IF;
END $$;

-- 8) Ensure FK inviterId -> User.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public."ReferralRewardGrant"'::regclass
      AND c.contype = 'f'
      AND a.attname = 'inviterId'
  ) THEN
    ALTER TABLE public."ReferralRewardGrant"
      ADD CONSTRAINT "ReferralRewardGrant_inviterId_fkey"
      FOREIGN KEY ("inviterId") REFERENCES public."User"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;

-- 9) Ensure FK referredUserId -> User.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public."ReferralRewardGrant"'::regclass
      AND c.contype = 'f'
      AND a.attname = 'referredUserId'
  ) THEN
    ALTER TABLE public."ReferralRewardGrant"
      ADD CONSTRAINT "ReferralRewardGrant_referredUserId_fkey"
      FOREIGN KEY ("referredUserId") REFERENCES public."User"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;

-- 10) Ensure covering index for inviterId + createdAt
CREATE INDEX IF NOT EXISTS "ReferralRewardGrant_inviterId_createdAt_idx"
  ON public."ReferralRewardGrant"("inviterId", "createdAt");
