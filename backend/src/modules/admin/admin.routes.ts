import { Router } from 'express';
import { requireAdminAuth, requireSuperAdmin } from '../../middleware/adminAuth';
import {
  getMetrics,
  createReward,
  updateReward,
  deleteReward,
  listRewardsByBox,
  freezeUserHandler,
  unfreezeUserHandler,
  revokeRewardHandler,
  runtimeCheckHandler,
  verifySystemIntegrityHandler,
  verifyWalletConstraintIntegrityHandler,
  getFraudEventsHandler,
  getHighRiskUsersHandler,
  freezeUser,
  revokeReward,
  listAdmins,
  createAdmin,
  getAdminConfig,
  getGameRewardsConfig,
  removeAdmin,
  patchAdminConfig,
  updateGameRewardsConfig,
  updateReferralBonus,
  updateConfig,
} from './admin.controller';
import { validateBody } from "../../middleware/validate";
import {
  adminActionSchema,
  adminConfigUpdateSchema,
  adminCreateRemoveSchema,
  adminFreezeUserSchema,
  adminGameRewardsConfigSchema,
  adminReferralBonusSchema,
  adminRevokeSchema,
  adminRewardSchema,
} from "../../validators/admin.validator";

const router = Router();

router.get('/admin/metrics', requireAdminAuth, getMetrics);
router.get('/admin/list', requireAdminAuth, listAdmins);
router.get('/admin/config', requireAdminAuth, getAdminConfig);
router.get('/admin/game-config', requireAdminAuth, getGameRewardsConfig);
router.post('/admin/create-admin', requireAdminAuth, requireSuperAdmin, validateBody(adminCreateRemoveSchema), createAdmin);
router.delete('/admin/remove-admin', requireAdminAuth, requireSuperAdmin, validateBody(adminCreateRemoveSchema), removeAdmin);
router.post('/admin/rewards', requireAdminAuth, validateBody(adminRewardSchema), createReward);
router.put('/admin/rewards/:id', requireAdminAuth, validateBody(adminRewardSchema), updateReward);
router.delete('/admin/rewards/:id', requireAdminAuth, deleteReward);
router.get('/admin/rewards/:boxId', requireAdminAuth, listRewardsByBox);

// NEW: Admin control endpoints
router.post('/admin/freeze', requireAdminAuth, validateBody(adminActionSchema), freezeUserHandler);
router.post('/admin/unfreeze', requireAdminAuth, validateBody(adminActionSchema), unfreezeUserHandler);
router.post('/admin/freeze-user', requireAdminAuth, validateBody(adminFreezeUserSchema), freezeUserHandler);
router.post('/admin/unfreeze-user', requireAdminAuth, validateBody(adminFreezeUserSchema), unfreezeUserHandler);
router.post('/admin/revoke', requireAdminAuth, validateBody(adminActionSchema), revokeRewardHandler);
router.get('/admin/integrity', requireAdminAuth, verifySystemIntegrityHandler);
router.get('/admin/db-integrity', requireAdminAuth, verifyWalletConstraintIntegrityHandler);
router.get('/admin/runtime-check', requireAdminAuth, runtimeCheckHandler);
router.get('/admin/fraud-events', requireAdminAuth, getFraudEventsHandler);
router.get('/admin/high-risk-users', requireAdminAuth, getHighRiskUsersHandler);
router.post('/admin/referral-bonus', requireAdminAuth, validateBody(adminReferralBonusSchema), updateReferralBonus);
router.patch('/admin/config', requireAdminAuth, validateBody(adminGameRewardsConfigSchema), patchAdminConfig);
router.put('/admin/game-config', requireAdminAuth, validateBody(adminGameRewardsConfigSchema), updateGameRewardsConfig);
router.patch('/admin/game-config', requireAdminAuth, validateBody(adminGameRewardsConfigSchema), patchAdminConfig);

// NEW: User endpoints
router.post('/user/freeze', requireAdminAuth, validateBody(adminFreezeUserSchema), freezeUser);
router.post('/reward/revoke', requireAdminAuth, validateBody(adminRevokeSchema), revokeReward);
router.post('/config/update', requireAdminAuth, validateBody(adminConfigUpdateSchema), updateConfig);

export default router;
