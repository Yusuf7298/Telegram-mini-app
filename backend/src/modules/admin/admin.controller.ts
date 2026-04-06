import { verifySystemIntegrity } from '../../services/systemStats.service';

// System-wide financial integrity verification endpoint
export async function verifySystemIntegrityHandler(req: Request, res: Response) {
  try {
    const result = await verifySystemIntegrity();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
import { freezeUser, unfreezeUser, revokeReward } from '../../services/admin.service';
import { logAdminAudit } from '../../services/adminAuditLog.service';
import { logSuspiciousAction } from '../../services/suspiciousActionLog.service';
import crypto from 'crypto';
// NEW: Freeze user
  try {
    const { userId, confirmationToken } = req.body;
    // Confirm token
    if (!validateAdminConfirmationToken(confirmationToken, req)) {
      return res.status(403).json({ error: 'Invalid or expired confirmation token' });
    }
    const before = await getUserState(userId);
    await freezeUser(userId);
    const after = await getUserState(userId);
    await logAdminAudit({
      adminId: req.user.id,
      action: 'freeze',
      targetUserId: userId,
      metadata: {
        ip: req.ip,
        device: req.headers['user-agent'],
        before,
        after,
      },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

// NEW: Unfreeze user
  try {
    const { userId, confirmationToken } = req.body;
    if (!validateAdminConfirmationToken(confirmationToken, req)) {
      return res.status(403).json({ error: 'Invalid or expired confirmation token' });
    }
    const before = await getUserState(userId);
    await unfreezeUser(userId);
    const after = await getUserState(userId);
    await logAdminAudit({
      adminId: req.user.id,
      action: 'unfreeze',
      targetUserId: userId,
      metadata: {
        ip: req.ip,
        device: req.headers['user-agent'],
        before,
        after,
      },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

// NEW: Revoke reward
  try {
    const { transactionId, reason, confirmationToken } = req.body;
    if (!validateAdminConfirmationToken(confirmationToken, req)) {
      return res.status(403).json({ error: 'Invalid or expired confirmation token' });
    }
    // Prevent mass reward revoke: only allow one at a time
    // (could be extended to check for batch requests)
    // Large balance change flagging
    const txn = await getTransactionState(transactionId);
    const before = await getUserState(txn.userId);
    await revokeReward(transactionId, reason);
    const after = await getUserState(txn.userId);
    // Calculate adminRiskScore
    const riskScore = calculateAdminRiskScore({ action: 'revoke', txn, before, after, req });
    await logAdminAudit({
      adminId: req.user.id,
      action: 'revoke',
      targetUserId: txn.userId,
      metadata: {
        ip: req.ip,
        device: req.headers['user-agent'],
        before,
        after,
        transactionId,
        reason,
        adminRiskScore: riskScore,
      },
    });
    if (riskScore >= 8) {
      await logSuspiciousAction({ userId: req.user.id, type: 'admin_high_risk_action', metadata: { action: 'revoke', transactionId, riskScore, ip: req.ip }, tx: undefined });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

// --- Admin confirmation token logic ---
const ADMIN_CONFIRMATION_TOKENS = new Map();
export function generateAdminConfirmationToken(adminId: string) {
  const token = crypto.randomBytes(16).toString('hex');
  ADMIN_CONFIRMATION_TOKENS.set(token, { adminId, expires: Date.now() + 30_000 });
  return token;
}
export function validateAdminConfirmationToken(token: string, req: any) {
  const entry = ADMIN_CONFIRMATION_TOKENS.get(token);
  if (!entry) return false;
  if (entry.adminId !== req.user.id) return false;
  if (Date.now() > entry.expires) {
    ADMIN_CONFIRMATION_TOKENS.delete(token);
    return false;
  }
  ADMIN_CONFIRMATION_TOKENS.delete(token);
  return true;
}

// --- State snapshot helpers ---
import { prisma } from '../../config/db';
async function getUserState(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { wallet: true } });
  return user;
}
async function getTransactionState(transactionId: string) {
  const txn = await prisma.transaction.findUnique({ where: { id: transactionId } });
  return txn;
}

// --- Admin risk scoring ---
function calculateAdminRiskScore({ action, txn, before, after, req }: any) {
  let score = 0;
  // Large balance change
  if (txn && Math.abs(Number(txn.amount)) > 1000) score += 5;
  // Revoke of high-value reward
  if (txn && txn.type === 'BOX_REWARD' && Math.abs(Number(txn.amount)) > 500) score += 2;
  // If admin IP is not whitelisted (example, not 127.0.0.1)
  if (req.ip !== '127.0.0.1') score += 1;
  // If before/after state shows negative balance
  if (after && after.wallet && Number(after.wallet.cashBalance) < 0) score += 2;
  return score;
}
import { Request, Response } from 'express';
import { getSystemMetrics } from '../../services/systemStats.service';
import { createBoxReward, updateBoxReward, deleteBoxReward, listBoxRewardsByBox } from '../../services/boxRewardAdmin.service';
import { adjustRewardProbabilities } from "../../services/rtp.service";

export async function getMetrics(req: Request, res: Response) {
  try {
    const metrics = await getSystemMetrics();
    res.json(metrics);
  } catch {
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
}

export async function createReward(req: Request, res: Response) {
  try {
    const reward = await createBoxReward(req.body, req.tx);
    res.status(201).json(reward);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function updateReward(req: Request, res: Response) {
  try {
    const reward = await updateBoxReward(req.params.id, req.body, req.tx);
    res.json(reward);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteReward(req: Request, res: Response) {
  try {
    await deleteBoxReward(req.params.id, req.tx);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function listRewardsByBox(req: Request, res: Response) {
  try {
    const rewards = await listBoxRewardsByBox(req.params.boxId, req.tx);
    res.json(rewards);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function freezeUser(req: Request, res: Response) {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: "userId required" });
    await prisma.user.update({ where: { id: userId }, data: { isFrozen: true } });
    await logAudit({ userId: req.userId, action: "admin_freeze_user", details: { targetUserId: userId } });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Failed to freeze user" });
  }
}

export async function revokeReward(req: Request, res: Response) {
  try {
    const { transactionId } = req.body;
    if (!transactionId) return res.status(400).json({ success: false, error: "transactionId required" });
    const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) return res.status(404).json({ success: false, error: "Transaction not found" });
    // Reverse the reward
    await prisma.wallet.update({ where: { userId: tx.userId }, data: { cashBalance: { decrement: tx.amount } } });
    await prisma.transaction.create({
      data: {
        userId: tx.userId,
        type: "REWARD_REVOKE",
        amount: -tx.amount,
        balanceBefore: tx.balanceAfter,
        balanceAfter: tx.balanceAfter.minus(tx.amount),
        meta: { revokedTransactionId: transactionId },
      },
    });
    await logAudit({ userId: req.userId, action: "admin_revoke_reward", details: { transactionId } });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Failed to revoke reward" });
  }
}

export async function updateConfig(req: Request, res: Response) {
  try {
    const { rtp, boxRewards } = req.body;
    if (rtp !== undefined) {
      await prisma.gameConfig.update({ where: { id: "global" }, data: { rtpModifier: rtp } });
      await logAudit({ userId: req.userId, action: "admin_update_rtp", details: { rtp } });
      await adjustRewardProbabilities(true);
    }
    if (Array.isArray(boxRewards)) {
      for (const reward of boxRewards) {
        await prisma.boxReward.update({ where: { id: reward.id }, data: { weight: reward.weight, reward: reward.reward } });
      }
      await logAudit({ userId: req.userId, action: "admin_update_box_rewards", details: { boxRewards } });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Failed to update config" });
  }
}
