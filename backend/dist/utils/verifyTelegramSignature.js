"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyTelegramSignature = verifyTelegramSignature;
const crypto_1 = __importDefault(require("crypto"));
/**
 * Verifies Telegram Mini App initData signature using HMAC-SHA256.
 * @param initData The raw initData string from Telegram
 * @param botToken The Telegram bot token
 * @returns { valid: boolean, data?: any, reason?: string }
 */
function verifyTelegramSignature(initData, botToken) {
    try {
        // Parse initData into key-value pairs
        const params = new URLSearchParams(initData);
        const data = {};
        for (const [key, value] of params.entries()) {
            data[key] = value;
        }
        const hash = data["hash"];
        if (!hash)
            return { valid: false, reason: "Missing hash" };
        // Remove hash for signature check
        delete data["hash"];
        // Sort keys and build data_check_string
        const dataCheckString = Object.keys(data)
            .sort()
            .map((key) => `${key}=${data[key]}`)
            .join("\n");
        // Compute secret key
        const secret = crypto_1.default.createHash("sha256").update(botToken).digest();
        // Compute HMAC-SHA256
        const hmac = crypto_1.default.createHmac("sha256", secret).update(dataCheckString).digest("hex");
        if (hmac !== hash)
            return { valid: false, reason: "Invalid signature" };
        // Parse user data
        let user;
        if (data.user) {
            try {
                user = JSON.parse(data.user);
            }
            catch {
                return { valid: false, reason: "Invalid user JSON" };
            }
        }
        return { valid: true, data: { ...data, user } };
    }
    catch (err) {
        return { valid: false, reason: "Signature verification error" };
    }
}
