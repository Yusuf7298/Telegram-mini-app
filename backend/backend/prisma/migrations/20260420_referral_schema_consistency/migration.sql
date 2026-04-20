-- Referral schema consistency migration (safe, idempotent, no data loss)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReferralStatus') THEN
    CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'JOINED', 'ACTIVE');
  END IF;
END
$$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "referralStatus" "ReferralStatus",
  ADD COLUMN IF NOT EXISTS "referralJoinedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "referralActivatedAt" TIMESTAMP(3);

-- Backfill missing lifecycle state to PENDING.
UPDATE "User"
SET "referralStatus" = 'PENDING'::"ReferralStatus"
WHERE "referralStatus" IS NULL;

ALTER TABLE "User"
  ALTER COLUMN "referralStatus" SET DEFAULT 'PENDING'::"ReferralStatus";

ALTER TABLE "User"
  ALTER COLUMN "referralStatus" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "ReferralRewardGrant" (
  "id" TEXT NOT NULL,
  "referrerId" TEXT NOT NULL,
  "referredUserId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "sourceAction" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralRewardGrant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReferralRewardGrant_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReferralRewardGrant_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReferralRewardGrant_referredUserId_key"
  ON "ReferralRewardGrant"("referredUserId");

CREATE INDEX IF NOT EXISTS "ReferralRewardGrant_referrerId_createdAt_idx"
  ON "ReferralRewardGrant"("referrerId", "createdAt");
