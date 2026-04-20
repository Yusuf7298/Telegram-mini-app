import fs from "fs";
import path from "path";
import { prisma } from "../src/config/db";

type LogRow = {
  level?: string;
  timestamp?: string;
  event?: string;
  inviterId?: string;
  referredUserId?: string;
  rewardAmount?: string;
  status?: string;
  referralId?: string | null;
  transactionId?: string | null;
  correlationId?: string;
};

function decodeLogFile(filePath: string): string {
  const buf = fs.readFileSync(filePath);

  // PowerShell redirection often writes UTF-16LE on Windows.
  const looksUtf16Le = buf.length > 2 && buf[0] === 0xff && buf[1] === 0xfe;
  if (looksUtf16Le) {
    return buf.toString("utf16le");
  }

  return buf.toString("utf8");
}

function parseStructuredLogs(filePath: string): LogRow[] {
  const raw = decodeLogFile(filePath);
  const rows: LogRow[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
      continue;
    }

    try {
      const parsed = JSON.parse(trimmed) as LogRow;
      if (parsed && parsed.event) {
        rows.push(parsed);
      }
    } catch {
      // Ignore non-JSON/non-structured lines.
    }
  }

  return rows;
}

function hasRequiredFields(row: LogRow) {
  return Boolean(
    row.inviterId &&
      row.referredUserId &&
      row.rewardAmount !== undefined &&
      row.status &&
      row.timestamp !== undefined
  );
}

async function main() {
  const argPath = process.argv[2];
  const logFilePath = argPath
    ? path.resolve(process.cwd(), argPath)
    : path.resolve(process.cwd(), "stress_run_output.log");

  if (!fs.existsSync(logFilePath)) {
    throw new Error(`Log file not found: ${logFilePath}`);
  }

  const structured = parseStructuredLogs(logFilePath);
  const rewardLogs = structured.filter((row) => row.event === "referral_reward_granted");
  const duplicateLogs = structured.filter((row) => row.event === "referral_duplicate_blocked");

  const issues: Array<Record<string, unknown>> = [];

  for (const row of rewardLogs) {
    if (!hasRequiredFields(row)) {
      issues.push({
        check: "reward_log_required_fields",
        result: "fail",
        row,
        reason: "missing normalized payload fields",
      });
      continue;
    }

    if (!row.referralId || !row.transactionId) {
      issues.push({
        check: "reward_log_correlation_fields",
        result: "fail",
        row,
        reason: "transactionId/referralId must be present for referral_reward_granted",
      });
      continue;
    }

    const [grant, tx] = await Promise.all([
      prisma.referralRewardGrant.findUnique({
        where: { id: row.referralId },
      }),
      prisma.transaction.findUnique({
        where: { id: row.transactionId },
      }),
    ]);

    if (!grant) {
      issues.push({
        check: "reward_log_matches_db",
        result: "fail",
        row,
        reason: "ReferralRewardGrant not found",
      });
      continue;
    }

    if (!tx) {
      issues.push({
        check: "reward_log_matches_db",
        result: "fail",
        row,
        reason: "REFERRAL transaction not found",
      });
      continue;
    }

    const txMetaReferredUserId =
      tx.meta && typeof tx.meta === "object"
        ? (tx.meta as Record<string, unknown>).referredUserId
        : undefined;

    const grantMatches =
      grant.referrerId === row.inviterId &&
      grant.referredUserId === row.referredUserId &&
      grant.amount.toString() === row.rewardAmount;

    const txMatches =
      tx.userId === row.inviterId &&
      tx.type === "REFERRAL" &&
      tx.amount.toString() === row.rewardAmount &&
      txMetaReferredUserId === row.referredUserId;

    if (!grantMatches || !txMatches) {
      issues.push({
        check: "reward_log_matches_db",
        result: "fail",
        row,
        reason: "log payload does not match persisted DB records",
        details: {
          grant: {
            id: grant.id,
            referrerId: grant.referrerId,
            referredUserId: grant.referredUserId,
            amount: grant.amount.toString(),
          },
          tx: {
            id: tx.id,
            userId: tx.userId,
            type: tx.type,
            amount: tx.amount.toString(),
            referredUserId: txMetaReferredUserId,
          },
        },
      });
    }
  }

  for (const row of duplicateLogs) {
    if (!hasRequiredFields(row)) {
      issues.push({
        check: "duplicate_log_required_fields",
        result: "fail",
        row,
        reason: "missing normalized payload fields",
      });
      continue;
    }

    const [grantCount, referralTxCount] = await Promise.all([
      prisma.referralRewardGrant.count({
        where: { referredUserId: row.referredUserId },
      }),
      prisma.transaction.count({
        where: {
          userId: row.inviterId,
          type: "REFERRAL",
          meta: {
            path: ["referredUserId"],
            equals: row.referredUserId,
          },
        },
      }),
    ]);

    // If duplicate block is correct, we should never create extra wallet-credit transactions.
    if (grantCount > 1 || referralTxCount > 1) {
      issues.push({
        check: "duplicate_blocked_must_not_change_wallet",
        result: "fail",
        row,
        reason: "duplicate path produced additional reward records",
        details: { grantCount, referralTxCount },
      });
    }

    if (row.referralId) {
      const grant = await prisma.referralRewardGrant.findUnique({ where: { id: row.referralId } });
      if (!grant) {
        issues.push({
          check: "duplicate_log_correlation_fields",
          result: "fail",
          row,
          reason: "referralId does not exist",
        });
      }
    }

    if (row.transactionId) {
      const tx = await prisma.transaction.findUnique({ where: { id: row.transactionId } });
      if (!tx || tx.type !== "REFERRAL") {
        issues.push({
          check: "duplicate_log_correlation_fields",
          result: "fail",
          row,
          reason: "transactionId missing or not a REFERRAL transaction",
        });
      }
    }
  }

  const output = {
    logFilePath,
    scanned: {
      totalStructuredLogs: structured.length,
      referralRewardGranted: rewardLogs.length,
      referralDuplicateBlocked: duplicateLogs.length,
    },
    checks: {
      rewardLogMatchesDb: issues.filter((i) => i.check === "reward_log_matches_db").length === 0,
      duplicateBlockedNoExtraWalletChange:
        issues.filter((i) => i.check === "duplicate_blocked_must_not_change_wallet").length === 0,
      normalizedPayloadPresent:
        issues.filter((i) =>
          ["reward_log_required_fields", "duplicate_log_required_fields"].includes(String(i.check))
        ).length === 0,
    },
    issues,
  };

  console.log(JSON.stringify(output, null, 2));

  if (issues.length > 0) {
    process.exitCode = 1;
  }
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
