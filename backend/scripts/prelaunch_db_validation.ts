import { prisma } from '../src/config/db';

type Report = {
  errors: Array<{ code: string; message: string; sample?: any[] }>;
  warnings: Array<{ code: string; message: string; sample?: any[] }>;
  summary: Record<string, number>;
};

async function run() {
  const report: Report = { errors: [], warnings: [], summary: {} };

  // 1. Wallets: no negative balances
  try {
    const negativeWallets = await prisma.wallet.findMany({
      where: {
        OR: [{ cashBalance: { lt: 0 } }, { bonusBalance: { lt: 0 } }],
      },
      select: { userId: true, cashBalance: true, bonusBalance: true },
      take: 200,
    });
    report.summary.negativeWallets = negativeWallets.length;
    if (negativeWallets.length > 0) {
      report.errors.push({ code: 'WALLET_NEGATIVE', message: 'Found wallets with negative balances', sample: negativeWallets.slice(0, 50) });
    }
  } catch (err) {
    report.errors.push({ code: 'CHECK_WALLET_NEGATIVE_FAILED', message: String(err) });
  }

  // 1.b Wallets: balances match latest transaction.balanceAfter
  try {
    const mismatches = await prisma.$queryRaw<Array<{ userid: string; wallet_total: string; tx_balance_after: string }>>`
      SELECT w."userId" as userid, (w."cashBalance" + w."bonusBalance")::text as wallet_total, t.balanceafter::text as tx_balance_after
      FROM "Wallet" w
      JOIN LATERAL (
        SELECT "balanceAfter" as balanceafter FROM "Transaction" t2 WHERE t2."userId" = w."userId" ORDER BY t2."createdAt" DESC LIMIT 1
      ) t ON true
      WHERE (w."cashBalance" + w."bonusBalance")::text <> t.balanceafter::text
      LIMIT 200
    `;

    report.summary.walletBalanceMismatches = mismatches.length;
    if (mismatches.length > 0) {
      report.errors.push({ code: 'WALLET_TX_MISMATCH', message: 'Wallet total does not match latest transaction balanceAfter', sample: mismatches });
    }
  } catch (err) {
    report.errors.push({ code: 'CHECK_WALLET_MISMATCH_FAILED', message: String(err) });
  }

  // 2.a Referral: duplicate referredUserId in ReferralRewardGrant
  try {
    const groups = await prisma.referralRewardGrant.groupBy({ by: ['referredUserId'], _count: { _all: true } });
    const duplicates = groups.filter((g) => g._count._all > 1).map((g) => ({ referredUserId: g.referredUserId, count: g._count._all }));
    report.summary.duplicateReferralGrants = duplicates.length;
    if (duplicates.length > 0) {
      report.errors.push({ code: 'DUPLICATE_REFERRAL_GRANT', message: 'Found multiple referralRewardGrant rows for the same referredUserId', sample: duplicates.slice(0, 200) });
    }
  } catch (err) {
    report.errors.push({ code: 'CHECK_DUPLICATE_REFERRAL_FAILED', message: String(err) });
  }

  // 2.b ACTIVE without reward grant
  try {
    const activeWithoutGrant = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT u.id FROM "User" u
      WHERE u."referralStatus" = 'ACTIVE' AND NOT EXISTS (
        SELECT 1 FROM "ReferralRewardGrant" g WHERE g."referredUserId" = u.id
      )
      LIMIT 200
    `;
    report.summary.activeWithoutGrant = activeWithoutGrant.length;
    if (activeWithoutGrant.length > 0) {
      report.errors.push({ code: 'ACTIVE_NO_GRANT', message: 'Users in ACTIVE referralStatus without a referralRewardGrant', sample: activeWithoutGrant.map((r) => r.id) });
    }
  } catch (err) {
    report.errors.push({ code: 'CHECK_ACTIVE_NO_GRANT_FAILED', message: String(err) });
  }

  // 2.c reward grant without ACTIVE
  try {
    const grantsWithoutActive = await prisma.$queryRaw<Array<{ id: string; referreduserid: string; userstatus: string | null }>>`
      SELECT g.id, g."referredUserId" as referreduserid, u."referralStatus" as userstatus
      FROM "ReferralRewardGrant" g
      LEFT JOIN "User" u ON u.id = g."referredUserId"
      WHERE u.id IS NULL OR u."referralStatus" IS DISTINCT FROM 'ACTIVE'
      LIMIT 200
    `;
    report.summary.grantWithoutActive = grantsWithoutActive.length;
    if (grantsWithoutActive.length > 0) {
      report.errors.push({ code: 'GRANT_NO_ACTIVE', message: 'ReferralRewardGrant exists for users that are not ACTIVE (or user missing)', sample: grantsWithoutActive });
    }
  } catch (err) {
    report.errors.push({ code: 'CHECK_GRANT_NO_ACTIVE_FAILED', message: String(err) });
  }

  // 3. Relations: orphan records
  try {
    // Wallets with no user
    const orphanWallets = await prisma.$queryRaw<Array<{ userid: string }>>`SELECT w."userId" as userid FROM "Wallet" w LEFT JOIN "User" u ON u.id = w."userId" WHERE u.id IS NULL LIMIT 200`;
    report.summary.orphanWallets = orphanWallets.length;
    if (orphanWallets.length > 0) {
      report.errors.push({ code: 'ORPHAN_WALLET', message: 'Wallet records with no corresponding user', sample: orphanWallets.map((r) => r.userid) });
    }

    // Transactions with missing user
    const orphanTx = await prisma.$queryRaw<Array<{ txid: string; userid: string }>>`SELECT t.id as txid, t."userId" as userid FROM "Transaction" t LEFT JOIN "User" u ON u.id = t."userId" WHERE u.id IS NULL LIMIT 200`;
    report.summary.orphanTransactions = orphanTx.length;
    if (orphanTx.length > 0) {
      report.errors.push({ code: 'ORPHAN_TRANSACTION', message: 'Transactions referencing missing users', sample: orphanTx.slice(0, 200) });
    }

    // ReferralLog orphans
    const orphanReferralLogs = await prisma.$queryRaw<Array<{ id: string }>>`SELECT rl.id FROM "ReferralLog" rl LEFT JOIN "User" u1 ON u1.id = rl."inviterId" LEFT JOIN "User" u2 ON u2.id = rl."referredUserId" WHERE u1.id IS NULL OR u2.id IS NULL LIMIT 200`;
    report.summary.orphanReferralLogs = orphanReferralLogs.length;
    if (orphanReferralLogs.length > 0) {
      report.warnings.push({ code: 'ORPHAN_REFERRAL_LOG', message: 'ReferralLog rows referencing missing users', sample: orphanReferralLogs.map((r) => r.id) });
    }
  } catch (err) {
    report.errors.push({ code: 'CHECK_RELATIONS_FAILED', message: String(err) });
  }

  // Summary counts for global context
  try {
    const totalUsers = await prisma.user.count();
    const totalWallets = await prisma.wallet.count();
    const totalTx = await prisma.transaction.count();
    report.summary.totalUsers = totalUsers;
    report.summary.totalWallets = totalWallets;
    report.summary.totalTransactions = totalTx;
  } catch (err) {
    // non-fatal
    report.warnings.push({ code: 'COUNT_FAILED', message: String(err) });
  }

  // Output JSON
  console.log(JSON.stringify(report, null, 2));

  const critical = report.errors.length;
  await prisma.$disconnect();
  process.exit(critical > 0 ? 1 : 0);
}

run().catch(async (err) => {
  console.error('prelaunch_db_validation failed', err);
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(2);
});
