"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramLogin = telegramLogin;
const auth_service_1 = require("./auth.service");
const telegramAuth_1 = require("./telegramAuth");
async function telegramLogin(req, res) {
    try {
        const { initData } = req.body;
        if (typeof initData !== "string" || !initData.trim()) {
            return res.status(400).json({ success: false, error: "initData is required" });
        }
        try {
            (0, telegramAuth_1.verifyTelegramData)(initData);
        }
        catch (authErr) {
            const authMessage = authErr instanceof Error ? authErr.message : "Invalid Telegram data";
            return res.status(401).json({ success: false, error: authMessage });
        }
        const user = await (0, auth_service_1.authWithTelegram)(initData);
        const token = (0, auth_service_1.generateToken)(user.id);
        return res.json({
            success: true,
            data: {
                token,
                user,
            },
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Auth failed";
        return res.status(500).json({ success: false, error: message });
    }
}
