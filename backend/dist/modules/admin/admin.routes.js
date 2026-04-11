"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const adminAuth_1 = require("../../middleware/adminAuth");
const admin_controller_1 = require("./admin.controller");
const validate_1 = require("../../middleware/validate");
const admin_validator_1 = require("../../validators/admin.validator");
const router = (0, express_1.Router)();
router.get('/admin/metrics', adminAuth_1.requireAdminAuth, admin_controller_1.getMetrics);
router.post('/admin/rewards', adminAuth_1.requireAdminAuth, admin_controller_1.createReward);
router.put('/admin/rewards/:id', adminAuth_1.requireAdminAuth, admin_controller_1.updateReward);
router.delete('/admin/rewards/:id', adminAuth_1.requireAdminAuth, admin_controller_1.deleteReward);
router.get('/admin/rewards/:boxId', adminAuth_1.requireAdminAuth, admin_controller_1.listRewardsByBox);
// NEW: Admin control endpoints
router.post('/admin/freeze', adminAuth_1.requireAdminAuth, (0, validate_1.validateBody)(admin_validator_1.adminActionSchema), admin_controller_1.freezeUserHandler);
router.post('/admin/unfreeze', adminAuth_1.requireAdminAuth, (0, validate_1.validateBody)(admin_validator_1.adminActionSchema), admin_controller_1.unfreezeUserHandler);
router.post('/admin/revoke', adminAuth_1.requireAdminAuth, (0, validate_1.validateBody)(admin_validator_1.adminActionSchema), admin_controller_1.revokeRewardHandler);
router.get('/admin/integrity', adminAuth_1.requireAdminAuth, admin_controller_1.verifySystemIntegrityHandler);
// NEW: User endpoints
router.post('/user/freeze', auth_middleware_1.requireAdmin, admin_controller_1.freezeUser);
router.post('/reward/revoke', auth_middleware_1.requireAdmin, admin_controller_1.revokeReward);
router.post('/config/update', auth_middleware_1.requireAdmin, admin_controller_1.updateConfig);
exports.default = router;
