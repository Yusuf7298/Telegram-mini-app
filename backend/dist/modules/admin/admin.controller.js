"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMetrics = getMetrics;
exports.verifySystemIntegrityHandler = verifySystemIntegrityHandler;
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
async function getMetrics(_req, res) {
    try {
        const metrics = await (0, systemStats_service_1.getSystemMetrics)();
        return res.json(metrics);
    }
    catch {
        return res.status(500).json({ error: "Failed to fetch metrics" });
    }
}
async function verifySystemIntegrityHandler(_req, res) {
    try {
        const result = await (0, systemStats_service_1.verifySystemIntegrity)();
        return res.json(result);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Verification failed";
        return res.status(500).json({ error: message });
    }
}
async function createReward(req, res) {
    try {
        const tx = req.tx ?? db_1.prisma;
        const reward = await (0, boxRewardAdmin_service_1.createBoxReward)(req.body, tx);
        return res.status(201).json(reward);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create reward";
        return res.status(400).json({ error: message });
    }
}
async function updateReward(req, res) {
    try {
        const tx = req.tx ?? db_1.prisma;
        const reward = await (0, boxRewardAdmin_service_1.updateBoxReward)(String(req.params.id), req.body, tx);
        return res.json(reward);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update reward";
        return res.status(400).json({ error: message });
    }
}
async function deleteReward(req, res) {
    try {
        const tx = req.tx ?? db_1.prisma;
        await (0, boxRewardAdmin_service_1.deleteBoxReward)(String(req.params.id), tx);
        return res.json({ success: true });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete reward";
        return res.status(400).json({ error: message });
    }
}
async function listRewardsByBox(req, res) {
    try {
        const tx = req.tx ?? db_1.prisma;
        const rewards = await (0, boxRewardAdmin_service_1.listBoxRewardsByBox)(String(req.params.boxId), tx);
        return res.json(rewards);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to list rewards";
        return res.status(400).json({ error: message });
    }
}
async function freezeUserHandler(req, res) {
    try {
        const userId = req.body?.targetId || req.body?.userId;
        if (!userId) {
            return res.status(400).json({ success: false, error: "userId is required" });
        }
        await (0, admin_service_1.freezeUser)(String(userId));
        return res.json({ success: true });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to freeze user";
        return res.status(400).json({ success: false, error: message });
    }
}
async function unfreezeUserHandler(req, res) {
    try {
        const userId = req.body?.targetId || req.body?.userId;
        if (!userId) {
            return res.status(400).json({ success: false, error: "userId is required" });
        }
        await (0, admin_service_1.unfreezeUser)(String(userId));
        return res.json({ success: true });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to unfreeze user";
        return res.status(400).json({ success: false, error: message });
    }
}
async function revokeRewardHandler(req, res) {
    try {
        const transactionId = req.body?.targetId || req.body?.transactionId;
        const reason = req.body?.reason || "admin_action";
        if (!transactionId) {
            return res.status(400).json({ success: false, error: "transactionId is required" });
        }
        await (0, admin_service_1.revokeReward)(String(transactionId), String(reason));
        return res.json({ success: true });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to revoke reward";
        return res.status(400).json({ success: false, error: message });
    }
}
async function freezeUser(req, res) {
    return freezeUserHandler(req, res);
}
async function revokeReward(req, res) {
    return revokeRewardHandler(req, res);
}
async function updateConfig(_req, res) {
    return res.json({ success: true });
}
