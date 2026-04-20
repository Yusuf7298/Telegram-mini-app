import { prisma } from "../src/config/db";

type TableExistsRow = { exists: boolean };
type ColumnExistsRow = { exists: boolean };

type WalletCreditWithoutValidMapping = {
  transactionId: string;
  userId: string;
  type: string;
  amount: string;
  boxId: string | null;
  createdAt: Date;
  meta: unknown;
};

type BrokenRelation = {
  check: string;
  relation: string;
  details: Record<string, unknown>;
};

async function tableExists(tableName: string) {
  const rows = await prisma.$queryRawUnsafe<TableExistsRow[]>(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '${tableName.replace(/'/g, "''")}'
    ) AS exists`
  );

  return Boolean(rows[0]?.exists);
}

async function columnExists(tableName: string, columnName: string) {
  const rows = await prisma.$queryRawUnsafe<ColumnExistsRow[]>(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = '${tableName.replace(/'/g, "''")}'
        AND column_name = '${columnName.replace(/'/g, "''")}'
    ) AS exists`
  );

  return Boolean(rows[0]?.exists);
}

async function main() {
  const grantTableExists = await tableExists("ReferralRewardGrant");
  const referralStatusExists = await columnExists("User", "referralStatus");

  const brokenRelations: BrokenRelation[] = [];

  // 1) For each ACTIVE referral: must have exactly 1 reward grant.
  if (!referralStatusExists) {
    brokenRelations.push({
      check: "active_referral_has_single_grant",
      relation: "schema_missing",
      details: {
        missingColumn: "User.referralStatus",
        message: "ACTIVE referral state does not exist in live DB schema.",
      },
    });
  }

  if (!grantTableExists) {
    brokenRelations.push({
      check: "active_referral_has_single_grant",
      relation: "schema_missing",
      details: {
        missingTable: "ReferralRewardGrant",
        message: "Reward grant table missing; cannot enforce one-grant-per-ACTIVE-referral invariant.",
      },
    });
  }

  // 2) For each reward grant: must have matching wallet transaction.
  if (!grantTableExists) {
    brokenRelations.push({
      check: "grant_has_matching_wallet_transaction",
      relation: "schema_missing",
      details: {
        missingTable: "ReferralRewardGrant",
        message: "Cannot verify grant-to-transaction linkage because grant table is absent.",
      },
    });
  }

  // 3) For each wallet credit: must map to valid referral or game action.
  const walletCreditsWithoutValidMapping = await prisma.$queryRawUnsafe<WalletCreditWithoutValidMapping[]>(`
    SELECT
      t.id AS "transactionId",
      t."userId",
      t.type,
      t.amount::text AS amount,
      t."boxId",
      t."createdAt",
      t.meta
    FROM "Transaction" t
    WHERE t.amount > 0
      AND NOT (
        (t.type = 'REFERRAL' AND COALESCE(t.meta->>'referredUserId', '') <> '')
        OR (t.type = 'BOX_REWARD' AND t."boxId" IS NOT NULL)
        OR t.type IN ('FREE_BOX', 'DAILY_REWARD', 'VAULT_REWARD', 'WELCOME_BONUS')
      )
    ORDER BY t."createdAt" DESC
  `);

  walletCreditsWithoutValidMapping.forEach((row) => {
    brokenRelations.push({
      check: "wallet_credit_maps_to_valid_referral_or_game_action",
      relation: "transaction_unmapped",
      details: {
        transactionId: row.transactionId,
        userId: row.userId,
        type: row.type,
        amount: row.amount,
        boxId: row.boxId,
        createdAt: row.createdAt,
        meta: row.meta,
      },
    });
  });

  const output = {
    brokenRelations,
    totals: {
      brokenRelations: brokenRelations.length,
      walletCreditsWithoutValidMapping: walletCreditsWithoutValidMapping.length,
    },
    schemaSnapshot: {
      hasUserReferralStatus: referralStatusExists,
      hasReferralRewardGrantTable: grantTableExists,
    },
  };

  console.log(JSON.stringify(output, null, 2));
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ error: message }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
