import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.middleware';
import {
  createReward,
  updateReward,
  deleteReward,
  listRewardsByBox,
  freezeUserHandler,
  unfreezeUserHandler,
  revokeRewardHandler,
  verifySystemIntegrityHandler,
} from './admin.controller';
import { validateBody } from "../../middleware/validate";
import { adminActionSchema } from "../../validators/admin.validator";

const router = Router();

router.get('/admin/metrics', requireAdminAuth, getMetrics);
router.post('/admin/rewards', requireAdminAuth, createReward);
router.put('/admin/rewards/:id', requireAdminAuth, updateReward);
router.delete('/admin/rewards/:id', requireAdminAuth, deleteReward);
router.get('/admin/rewards/:boxId', requireAdminAuth, listRewardsByBox);

// NEW: Admin control endpoints
router.post('/admin/freeze', requireAdminAuth, validateBody(adminActionSchema), freezeUserHandler);
router.post('/admin/unfreeze', requireAdminAuth, validateBody(adminActionSchema), unfreezeUserHandler);
router.post('/admin/revoke', requireAdminAuth, validateBody(adminActionSchema), revokeRewardHandler);

// NEW: User endpoints
router.post('/user/freeze', requireAdmin, freezeUser);
router.post('/reward/revoke', requireAdmin, revokeReward);
router.post('/config/update', requireAdmin, updateConfig);

export default router;
