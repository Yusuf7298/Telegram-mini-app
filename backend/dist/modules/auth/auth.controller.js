"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramLogin = telegramLogin;
const auth_service_1 = require("./auth.service");
const telegramAuth_1 = require("./telegramAuth");
const alert_service_1 = require("../../services/alert.service");
const responder_1 = require("../../utils/responder");
const telegramFailCounts = new Map();
async function telegramLogin(req, res) {
    try {
        const { initData } = req.body;
        if (typeof initData !== "string" || !initData.trim()) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "initData is required");
        }
        // Keep lightweight per-IP failure counters to detect brute force attempts.
        const ip = req.ip || "unknown";
        const failKey = `tgfail:${ip}`;
        try {
            (0, telegramAuth_1.verifyTelegramData)(initData);
            telegramFailCounts.delete(failKey);
        }
        catch (authErr) {
            const failedCount = (telegramFailCounts.get(failKey) || 0) + 1;
            telegramFailCounts.set(failKey, failedCount);
            if (failedCount > 3) {
                await alert_service_1.AlertService.failedTelegramAuth(null, ip, failedCount);
            }
            const authMessage = authErr instanceof Error ? authErr.message : "Invalid Telegram data";
            return (0, responder_1.failure)(res, "REPLAY_ATTACK", authMessage);
        }
        const user = await (0, auth_service_1.authWithTelegram)(initData, {
            ip,
            deviceId: req.headers["x-device-id"] || undefined,
            userAgent: req.headers["user-agent"],
        });
        const token = (0, auth_service_1.generateToken)(user.id);
        return (0, responder_1.success)(res, {
            token,
            user,
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Auth failed";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
