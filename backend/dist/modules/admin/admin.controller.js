"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMetrics = getMetrics;
exports.getFraudEventsHandler = getFraudEventsHandler;
exports.getHighRiskUsersHandler = getHighRiskUsersHandler;
exports.verifySystemIntegrityHandler = verifySystemIntegrityHandler;
exports.verifyWalletConstraintIntegrityHandler = verifyWalletConstraintIntegrityHandler;
exports.runtimeCheckHandler = runtimeCheckHandler;
exports.createReward = createReward;
exports.updateReward = updateReward;
exports.deleteReward = deleteReward;
exports.listRewardsByBox = listRewardsByBox;
exports.freezeUserHandler = freezeUserHandler;
exports.unfreezeUserHandler = unfreezeUserHandler;
exports.revokeRewardHandler = revokeRewardHandler;
exports.freezeUser = freezeUser;
exports.revokeReward = revokeReward;
exports.updateConfig = updateConfig;
const db_1 = require("../../config/db");
const boxRewardAdmin_service_1 = require("../../services/boxRewardAdmin.service");
const admin_service_1 = require("../../services/admin.service");
const systemStats_service_1 = require("../../services/systemStats.service");
const runtimeCheck_service_1 = require("../../services/runtimeCheck.service");
const responder_1 = require("../../utils/responder");
const adminMonitoring_service_1 = require("../../services/adminMonitoring.service");
async function getMetrics(_req, res) {
    try {
        const metrics = await (0, systemStats_service_1.getSystemMetrics)();
        return (0, responder_1.success)(res, metrics);
    }
    catch {
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", "Failed to fetch metrics");
    }
}
async function getFraudEventsHandler(_req, res) {
    try {
        const events = await (0, adminMonitoring_service_1.getFraudEvents)();
        return (0, responder_1.success)(res, events);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch fraud events";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function getHighRiskUsersHandler(_req, res) {
    try {
        const users = await (0, adminMonitoring_service_1.getHighRiskUsers)();
        return (0, responder_1.success)(res, users);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch high-risk users";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function verifySystemIntegrityHandler(_req, res) {
    try {
        const result = await (0, systemStats_service_1.verifySystemIntegrity)();
        return (0, responder_1.success)(res, result);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Verification failed";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function verifyWalletConstraintIntegrityHandler(_req, res) {
    try {
        const result = await (0, systemStats_service_1.verifyWalletConstraintIntegrity)();
        return (0, responder_1.success)(res, result);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Verification failed";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function runtimeCheckHandler(_req, res) {
    try {
        const result = await (0, runtimeCheck_service_1.runRuntimeCheck)();
        return (0, responder_1.success)(res, result);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Runtime check failed";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function createReward(req, res) {
    try {
        const tx = req.tx ?? db_1.prisma;
        const reward = await (0, boxRewardAdmin_service_1.createBoxReward)(req.body, tx);
        return (0, responder_1.success)(res, reward, 201);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create reward";
        return (0, responder_1.failure)(res, "INVALID_INPUT", message);
    }
}
async function updateReward(req, res) {
    try {
        const tx = req.tx ?? db_1.prisma;
        const reward = await (0, boxRewardAdmin_service_1.updateBoxReward)(String(req.params.id), req.body, tx);
        return (0, responder_1.success)(res, reward);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update reward";
        return (0, responder_1.failure)(res, "INVALID_INPUT", message);
    }
}
async function deleteReward(req, res) {
    try {
        const tx = req.tx ?? db_1.prisma;
        await (0, boxRewardAdmin_service_1.deleteBoxReward)(String(req.params.id), tx);
        return (0, responder_1.success)(res, {});
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete reward";
        return (0, responder_1.failure)(res, "INVALID_INPUT", message);
    }
}
async function listRewardsByBox(req, res) {
    try {
        const tx = req.tx ?? db_1.prisma;
        const rewards = await (0, boxRewardAdmin_service_1.listBoxRewardsByBox)(String(req.params.boxId), tx);
        return (0, responder_1.success)(res, rewards);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to list rewards";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function freezeUserHandler(req, res) {
    try {
        const userId = req.body?.targetId || req.body?.userId;
        if (!userId) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "userId is required");
        }
        await (0, admin_service_1.freezeUser)(String(userId));
        return (0, responder_1.success)(res, {});
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to freeze user";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function unfreezeUserHandler(req, res) {
    try {
        const userId = req.body?.targetId || req.body?.userId;
        if (!userId) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "userId is required");
        }
        await (0, admin_service_1.unfreezeUser)(String(userId));
        return (0, responder_1.success)(res, {});
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to unfreeze user";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function revokeRewardHandler(req, res) {
    try {
        const transactionId = req.body?.targetId || req.body?.transactionId;
        const reason = req.body?.reason || "admin_action";
        if (!transactionId) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "transactionId is required");
        }
        await (0, admin_service_1.revokeReward)(String(transactionId), String(reason));
        return (0, responder_1.success)(res, {});
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to revoke reward";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function freezeUser(req, res) {
    return freezeUserHandler(req, res);
}
async function revokeReward(req, res) {
    return revokeRewardHandler(req, res);
}
async function updateConfig(_req, res) {
    return (0, responder_1.success)(res, {});
}
