import { Router } from 'express';
import { requireAdminAuth } from '../../middleware/adminAuth';
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
  updateConfig,
} from './admin.controller';
import { validateBody } from "../../middleware/validate";
import {
  adminActionSchema,
  adminConfigUpdateSchema,
  adminFreezeUserSchema,
  adminRevokeSchema,
  adminRewardSchema,
} from "../../validators/admin.validator";

const router = Router();

router.get('/admin/metrics', requireAdminAuth, getMetrics);
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

// NEW: User endpoints
router.post('/user/freeze', requireAdminAuth, validateBody(adminFreezeUserSchema), freezeUser);
router.post('/reward/revoke', requireAdminAuth, validateBody(adminRevokeSchema), revokeReward);
router.post('/config/update', requireAdminAuth, validateBody(adminConfigUpdateSchema), updateConfig);

export default router;
