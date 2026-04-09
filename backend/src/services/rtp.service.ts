import { prisma } from "../config/db";
import { Prisma } from "@prisma/client";
import { D } from "../utils/money";

const TARGET_RTP = D(75);
const ALLOWED_DEVIATION = D(5); // percent

// Calculate RTP as totalOut / totalIn * 100 (Decimal math)
export async function calculateRTP() {
  const stats = await prisma.systemStats.findUnique({ where: { id: "global" } });
  if (!stats) throw new Error("SystemStats not found");
  const totalIn = D(stats.totalIn);
  const totalOut = D(stats.totalOut);
  if (totalIn.isZero()) return D(0);
  const rtp = totalOut.div(totalIn).mul(D(100)).toDecimalPlaces(2);
  return rtp;
}

// Adjust reward probabilities if RTP deviates >5% from target
export async function adjustRewardProbabilities(adminOverride = false) {
  const rtp = await calculateRTP();
  const diff = rtp.minus(TARGET_RTP).abs();
  if (diff.lte(ALLOWED_DEVIATION) && !adminOverride) {
    return { adjusted: false, rtp: rtp.toString(), message: "RTP within allowed range" };
  }
  // Fetch all BoxRewards
  const rewards = await prisma.boxReward.findMany();
  // Compute adjustment factor
  let factor = D(1);
  if (rtp.lt(TARGET_RTP)) {
    // RTP too low: increase reward weights
    factor = TARGET_RTP.div(rtp);
  } else if (rtp.gt(TARGET_RTP)) {
    // RTP too high: decrease reward weights
    factor = TARGET_RTP.div(rtp);
  }
  // Clamp factor to avoid extreme changes
  if (factor.lt(D(0.8))) factor = D(0.8);
  if (factor.gt(D(1.2))) factor = D(1.2);
  // Adjust all non-jackpot weights
  for (const reward of rewards) {
    if (!reward.isJackpot) {
      const newWeight = D(reward.weight).mul(factor).toDecimalPlaces(0, 1).toNumber();
      await prisma.boxReward.update({ where: { id: reward.id }, data: { weight: newWeight } });
    }
  }
  // Log adjustment
  await prisma.adminAuditLog.create({
    data: {
      action: "adjust_rtp",
      entity: "BoxReward",
      data: { prevRTP: rtp.toString(), targetRTP: TARGET_RTP.toString(), factor: factor.toString() },
    },
  });
  return { adjusted: true, rtp: rtp.toString(), factor: factor.toString() };
}