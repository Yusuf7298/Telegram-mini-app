import { prisma } from "../src/config/db";
import { retryPrisma } from "../src/services/retryPrisma";

type TableName = "User" | "Wallet" | "ReferralRewardGrant";

type ColumnMeta = {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: "YES" | "NO";
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  datetime_precision: number | null;
};

type ConstraintRow = {
  constraint_name: string;
  constraint_type: string;
  columns: string[];
  referenced_table?: string | null;
  referenced_columns?: string[] | null;
};

type IndexRow = {
  index_name: string;
  columns: string[];
  is_unique: boolean;
};

type ColumnIssue = {
  column: string;
  expectedType: string;
  actualType?: string;
  expectedNullable: boolean;
  actualNullable?: boolean;
};

type ConstraintIssue = {
  kind: "PRIMARY KEY" | "UNIQUE" | "FOREIGN KEY";
  columns: string[];
  references?: {
    table: string;
    columns: string[];
  };
};

type IndexIssue = {
  columns: string[];
  unique: boolean;
};

type TableReport = {
  table: TableName;
  missingColumns: ColumnIssue[];
  mismatchedTypes: ColumnIssue[];
  missingIndexes: IndexIssue[];
  missingConstraints: ConstraintIssue[];
};

type ExpectedColumn = {
  name: string;
  type: string;
  nullable: boolean;
};

type ExpectedIndex = {
  columns: string[];
  unique?: boolean;
};

type ExpectedConstraint =
  | {
      kind: "PRIMARY KEY" | "UNIQUE";
      columns: string[];
    }
  | {
      kind: "FOREIGN KEY";
      columns: string[];
      references: {
        table: string;
        columns: string[];
      };
    };

type TableExpectation = {
  columns: ExpectedColumn[];
  indexes: ExpectedIndex[];
  constraints: ExpectedConstraint[];
};

const TABLES: Record<TableName, TableExpectation> = {
  User: {
    columns: [
      { name: "id", type: "text", nullable: false },
      { name: "telegramId", type: "text", nullable: true },
      { name: "platformId", type: "text", nullable: false },
      { name: "username", type: "text", nullable: true },
      { name: "firstName", type: "text", nullable: true },
      { name: "lastName", type: "text", nullable: true },
      { name: "profilePhotoUrl", type: "text", nullable: true },
      { name: "role", type: "role", nullable: false },
      { name: "referralCode", type: "text", nullable: false },
      { name: "referredById", type: "text", nullable: true },
      { name: "deviceHash", type: "text", nullable: true },
      { name: "createdIp", type: "text", nullable: false },
      { name: "lastLoginIp", type: "text", nullable: false },
      { name: "riskScore", type: "integer", nullable: false },
      { name: "waitlistBonusEligible", type: "boolean", nullable: false },
      { name: "accountStatus", type: "text", nullable: false },
      { name: "lastPlayTimestamp", type: "timestamp", nullable: true },
      { name: "signupIp", type: "text", nullable: true },
      { name: "signupDeviceId", type: "text", nullable: true },
      { name: "referralCount", type: "integer", nullable: false },
      { name: "freeBoxUsed", type: "boolean", nullable: false },
      { name: "paidBoxesOpened", type: "integer", nullable: false },
      { name: "totalPlaysCount", type: "integer", nullable: false },
      { name: "waitlistBonusGranted", type: "boolean", nullable: false },
      { name: "waitlistBonusUnlocked", type: "boolean", nullable: false },
      { name: "welcomeBonusUnlocked", type: "boolean", nullable: false },
      { name: "dailyRewardStreak", type: "integer", nullable: false },
      { name: "lastDailyRewardClaimAt", type: "timestamp", nullable: true },
      { name: "createdAt", type: "timestamp", nullable: false },
      { name: "referralStatus", type: "referralstatus", nullable: false },
      { name: "referralJoinedAt", type: "timestamp", nullable: true },
      { name: "referralActivatedAt", type: "timestamp", nullable: true },
      { name: "referralAttempts", type: "integer", nullable: false },
      { name: "lastReferralAt", type: "timestamp", nullable: true },
      { name: "isFrozen", type: "boolean", nullable: false },
    ],
    indexes: [
      { columns: ["createdIp"] },
      { columns: ["deviceHash"] },
      { columns: ["riskScore"] },
    ],
    constraints: [
      { kind: "PRIMARY KEY", columns: ["id"] },
      { kind: "UNIQUE", columns: ["telegramId"] },
      { kind: "UNIQUE", columns: ["platformId"] },
      { kind: "UNIQUE", columns: ["referralCode"] },
      { kind: "FOREIGN KEY", columns: ["referredById"], references: { table: "User", columns: ["id"] } },
    ],
  },
  Wallet: {
    columns: [
      { name: "id", type: "text", nullable: false },
      { name: "userId", type: "text", nullable: false },
      { name: "cashBalance", type: "numeric(10,2)", nullable: false },
      { name: "bonusBalance", type: "numeric(10,2)", nullable: false },
      { name: "bonusLocked", type: "boolean", nullable: false },
    ],
    indexes: [],
    constraints: [
      { kind: "PRIMARY KEY", columns: ["id"] },
      { kind: "UNIQUE", columns: ["userId"] },
      { kind: "FOREIGN KEY", columns: ["userId"], references: { table: "User", columns: ["id"] } },
    ],
  },
  ReferralRewardGrant: {
    columns: [
      { name: "id", type: "text", nullable: false },
      { name: "inviterId", type: "text", nullable: false },
      { name: "referredUserId", type: "text", nullable: false },
      { name: "amount", type: "numeric(10,2)", nullable: false },
      { name: "sourceAction", type: "text", nullable: false },
      { name: "createdAt", type: "timestamp", nullable: false },
    ],
    indexes: [{ columns: ["inviterId", "createdAt"] }],
    constraints: [
      { kind: "PRIMARY KEY", columns: ["id"] },
      { kind: "UNIQUE", columns: ["referredUserId"] },
      { kind: "FOREIGN KEY", columns: ["inviterId"], references: { table: "User", columns: ["id"] } },
      { kind: "FOREIGN KEY", columns: ["referredUserId"], references: { table: "User", columns: ["id"] } },
    ],
  },
};

function normalizeType(meta: ColumnMeta): string {
  const base = meta.data_type.toLowerCase();

  if (base === "character varying" || base === "text") {
    return "text";
  }

  if (base === "integer" || base === "smallint" || base === "bigint") {
    return base;
  }

  if (base === "boolean") {
    return "boolean";
  }

  if (base === "timestamp with time zone") {
    return "timestamptz";
  }

  if (base === "timestamp without time zone") {
    return "timestamp";
  }

  if (base === "numeric") {
    if (meta.numeric_precision !== null && meta.numeric_scale !== null) {
      return `numeric(${meta.numeric_precision},${meta.numeric_scale})`;
    }
    return "numeric";
  }

  if (base === "USER-DEFINED".toLowerCase()) {
    return meta.udt_name.toLowerCase();
  }

  return meta.udt_name ? meta.udt_name.toLowerCase() : base;
}

function sameColumns(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function fetchColumns(table: TableName): Promise<ColumnMeta[]> {
  return retryPrisma(() =>
    prisma.$queryRawUnsafe<ColumnMeta[]>(`
      SELECT
        column_name,
        data_type,
        udt_name,
        is_nullable,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        datetime_precision
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = '${table}'
      ORDER BY ordinal_position
    `)
  );
}

async function fetchUniqueAndPrimaryConstraints(table: TableName): Promise<ConstraintRow[]> {
  return retryPrisma(() =>
    prisma.$queryRawUnsafe<ConstraintRow[]>(`
      SELECT
        tc.constraint_name,
        tc.constraint_type,
        ARRAY_AGG(kcu.column_name ORDER BY kcu.ordinal_position) AS columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
       AND tc.table_name = kcu.table_name
      WHERE tc.table_schema = 'public'
        AND tc.table_name = '${table}'
        AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
      GROUP BY tc.constraint_name, tc.constraint_type
      ORDER BY tc.constraint_name
    `)
  );
}

async function fetchForeignKeys(table: TableName): Promise<ConstraintRow[]> {
  return retryPrisma(() =>
    prisma.$queryRawUnsafe<ConstraintRow[]>(`
      SELECT
        tc.constraint_name,
        tc.constraint_type,
        ARRAY_AGG(kcu.column_name ORDER BY kcu.ordinal_position) AS columns,
        ccu.table_name AS referenced_table,
        ARRAY_AGG(ccu.column_name ORDER BY kcu.position_in_unique_constraint) AS referenced_columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
       AND tc.table_name = kcu.table_name
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
       AND tc.table_schema = rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = rc.unique_constraint_name
       AND ccu.constraint_schema = rc.unique_constraint_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = '${table}'
        AND tc.constraint_type = 'FOREIGN KEY'
      GROUP BY tc.constraint_name, tc.constraint_type, ccu.table_name
      ORDER BY tc.constraint_name
    `)
  );
}

async function fetchIndexes(table: TableName): Promise<IndexRow[]> {
  return retryPrisma(() =>
    prisma.$queryRawUnsafe<IndexRow[]>(`
      SELECT
        i.relname AS index_name,
        ix.indisunique AS is_unique,
        ARRAY_AGG(a.attname ORDER BY g.ordinality) AS columns
      FROM pg_class t
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_index ix ON ix.indrelid = t.oid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS g(attnum, ordinality) ON true
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = g.attnum
      WHERE n.nspname = 'public'
        AND t.relname = '${table}'
        AND NOT ix.indisprimary
        AND NOT ix.indisunique
      GROUP BY i.relname, ix.indisunique
      ORDER BY i.relname
    `)
  );
}

function compareColumns(table: TableName, actualColumns: ColumnMeta[]) {
  const actualByName = new Map(actualColumns.map((column) => [column.column_name, column] as const));
  const missingColumns: ColumnIssue[] = [];
  const mismatchedTypes: ColumnIssue[] = [];

  for (const expected of TABLES[table].columns) {
    const actual = actualByName.get(expected.name);
    if (!actual) {
      missingColumns.push({
        column: expected.name,
        expectedType: expected.type,
        expectedNullable: expected.nullable,
      });
      continue;
    }

    const actualType = normalizeType(actual);
    const actualNullable = actual.is_nullable === "YES";
    if (actualType !== expected.type || actualNullable !== expected.nullable) {
      mismatchedTypes.push({
        column: expected.name,
        expectedType: expected.type,
        actualType,
        expectedNullable: expected.nullable,
        actualNullable,
      });
    }
  }

  return { missingColumns, mismatchedTypes };
}

function compareConstraints(
  table: TableName,
  uniqueAndPrimary: ConstraintRow[],
  foreignKeys: ConstraintRow[]
) {
  const missingConstraints: ConstraintIssue[] = [];

  for (const expected of TABLES[table].constraints) {
    if (expected.kind === "FOREIGN KEY") {
      const found = foreignKeys.some(
        (constraint) =>
          sameColumns(constraint.columns, expected.columns) &&
          constraint.referenced_table === expected.references.table &&
          sameColumns(constraint.referenced_columns ?? [], expected.references.columns)
      );

      if (!found) {
        missingConstraints.push(expected);
      }
      continue;
    }

    const found = uniqueAndPrimary.some(
      (constraint) =>
        constraint.constraint_type === expected.kind && sameColumns(constraint.columns, expected.columns)
    );

    if (!found) {
      missingConstraints.push(expected);
    }
  }

  return missingConstraints;
}

function compareIndexes(table: TableName, actualIndexes: IndexRow[]) {
  const missingIndexes: IndexIssue[] = [];

  for (const expected of TABLES[table].indexes) {
    const found = actualIndexes.some(
      (index) => sameColumns(index.columns, expected.columns) && index.is_unique === Boolean(expected.unique)
    );

    if (!found) {
      missingIndexes.push({
        columns: expected.columns,
        unique: Boolean(expected.unique),
      });
    }
  }

  return missingIndexes;
}

async function inspectTable(table: TableName): Promise<TableReport> {
  const [actualColumns, uniqueAndPrimaryConstraints, foreignKeys, actualIndexes] = await Promise.all([
    fetchColumns(table),
    fetchUniqueAndPrimaryConstraints(table),
    fetchForeignKeys(table),
    fetchIndexes(table),
  ]);

  const { missingColumns, mismatchedTypes } = compareColumns(table, actualColumns);
  const missingConstraints = compareConstraints(table, uniqueAndPrimaryConstraints, foreignKeys);
  const missingIndexes = compareIndexes(table, actualIndexes);

  return {
    table,
    missingColumns,
    mismatchedTypes,
    missingIndexes,
    missingConstraints,
  };
}

async function main() {
  const tables: TableReport[] = [];
  for (const table of ["ReferralRewardGrant", "User", "Wallet"] as const) {
    tables.push(await inspectTable(table));
  }

  const totals = tables.reduce(
    (accumulator, table) => {
      accumulator.missingColumns += table.missingColumns.length;
      accumulator.mismatchedTypes += table.mismatchedTypes.length;
      accumulator.missingIndexes += table.missingIndexes.length;
      accumulator.missingConstraints += table.missingConstraints.length;
      return accumulator;
    },
    {
      missingColumns: 0,
      mismatchedTypes: 0,
      missingIndexes: 0,
      missingConstraints: 0,
    }
  );

  console.log(
    JSON.stringify(
      {
        healthy: Object.values(totals).every((value) => value === 0),
        totals,
        tables,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          healthy: false,
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
