import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "../config/db";
import { D } from "../utils/money";

export function calculateRTP(totalIn: Prisma.Decimal | number | string, totalOut: Prisma.Decimal | number | string) {
  const inValue = D(totalIn);
  const outValue = D(totalOut);
  if (inValue.lte(0)) return D(0);
  return outValue.div(inValue).mul(D(100)).toDecimalPlaces(2);
}

export async function incrementBoxesOpened(tx?: Prisma.TransactionClient) {
  const client = tx || prisma;
  await client.systemStats.upsert({
    where: { id: "global" },
    update: { totalBoxesOpened: { increment: 1 } },
    create: {
      id: "global",
      totalIn: D(0),
      totalOut: D(0),
      totalBoxesOpened: 1,
      jackpotWins: 0,
    },
  });
}

export async function incrementJackpotWins(tx?: Prisma.TransactionClient) {
  const client = tx || prisma;
  await client.systemStats.upsert({
    where: { id: "global" },
    update: { jackpotWins: { increment: 1 } },
    create: {
      id: "global",
      totalIn: D(0),
      totalOut: D(0),
      totalBoxesOpened: 0,
      jackpotWins: 1,
    },
  });
}

export async function getSystemMetrics() {
  const stats = await prisma.systemStats.findUnique({ where: { id: "global" } });
  const totalIn = stats?.totalIn ?? D(0);
  const totalOut = stats?.totalOut ?? D(0);

  return {
    totalIn: totalIn.toString(),
    totalOut: totalOut.toString(),
    rtp: calculateRTP(totalIn, totalOut).toString(),
    totalBoxesOpened: stats?.totalBoxesOpened ?? 0,
    jackpotWins: stats?.jackpotWins ?? 0,
  };
}

export async function verifySystemIntegrity() {
  const issues: string[] = [];
  const wallets = await prisma.wallet.findMany();
  const negativeWallets = wallets.filter((wallet) => wallet.cashBalance.lt(0) || wallet.bonusBalance.lt(0));

  if (negativeWallets.length > 0) {
    issues.push(`Negative wallet balances found for userIds: ${negativeWallets.map((wallet) => wallet.userId).join(", ")}`);
  }

  const metrics = await getSystemMetrics();
  const rtp = Number(metrics.rtp);
  if (Number.isFinite(rtp) && (rtp < 0 || rtp > 100)) {
    issues.push(`RTP out of range: ${metrics.rtp}%`);
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export async function checkStatsIntegrity() {
  return verifySystemIntegrity();
}

class WalletConstraintRollback extends Error {
  constructor() {
    super("wallet-constraint-rollback");
    this.name = "WalletConstraintRollback";
  }
}

function isWalletConstraintViolation(err: unknown) {
  const error = err as { code?: string; message?: string; meta?: { message?: string } };
  const message = `${error?.message ?? ""} ${error?.meta?.message ?? ""}`.toLowerCase();

  return (
    error?.code === "P2004" ||
    message.includes("check constraint") ||
    message.includes("violates check constraint") ||
    message.includes("cashbalance") ||
    message.includes("cash_balance")
  );
}

export async function verifyWalletConstraintIntegrity() {
  const details: string[] = [];
  let walletConstraintEnforced = false;
  let rollbackVerified = false;

  try {
    await prisma.$transaction(async (tx) => {
      const suffix = randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
      const testUser = await tx.user.create({
        data: {
          platformId: `db-integrity-${suffix}`,
          referralCode: `DBINT${suffix}`,
          wallet: {
            create: {
              cashBalance: D(0),
              bonusBalance: D(0),
            },
          },
        },
        include: { wallet: true },
      });

      if (!testUser.wallet) {
        throw new Error("Failed to create test wallet for integrity check");
      }

      try {
        await tx.wallet.update({
          where: { userId: testUser.id },
          data: { cashBalance: D(-1) },
        });
        details.push("Wallet negative balance update unexpectedly succeeded");
      } catch (err: unknown) {
        if (!isWalletConstraintViolation(err)) {
          throw err;
        }

        walletConstraintEnforced = true;
        details.push("Wallet negative balance update was rejected by the database");
      }

      throw new WalletConstraintRollback();
    });
  } catch (err: unknown) {
    if (err instanceof WalletConstraintRollback) {
      rollbackVerified = true;
    } else {
      throw err;
    }
  }

  return {
    valid: walletConstraintEnforced && rollbackVerified,
    checks: {
      walletNonNegativeBalanceConstraint: walletConstraintEnforced,
      rollbackVerified,
    },
    details,
  };
}
