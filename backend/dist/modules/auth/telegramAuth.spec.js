"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const telegramAuth_1 = require("./telegramAuth");
function createTelegramInitData(input) {
    const params = new URLSearchParams();
    params.set("auth_date", String(input.authDate));
    params.set("query_id", "AAHdF6IQAAAAAN0XohDhrOrc");
    params.set("user", JSON.stringify(input.user));
    const dataCheckString = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");
    const secret = crypto_1.default
        .createHmac("sha256", "WebAppData")
        .update(input.botToken)
        .digest();
    const hash = crypto_1.default
        .createHmac("sha256", secret)
        .update(dataCheckString)
        .digest("hex");
    params.set("hash", hash);
    return params.toString();
}
describe("verifyTelegramData", () => {
    const originalBotToken = process.env.TELEGRAM_BOT_TOKEN;
    const botToken = "test-bot-token";
    beforeEach(() => {
        process.env.TELEGRAM_BOT_TOKEN = botToken;
    });
    afterAll(() => {
        process.env.TELEGRAM_BOT_TOKEN = originalBotToken;
    });
    it("accepts valid Telegram initData", () => {
        const initData = createTelegramInitData({
            botToken,
            authDate: Math.floor(Date.now() / 1000),
            user: {
                id: 12345,
                username: "valid_user",
            },
        });
        expect((0, telegramAuth_1.verifyTelegramData)(initData)).toBe(true);
    });
    it("rejects invalid Telegram signature", () => {
        const initData = createTelegramInitData({
            botToken,
            authDate: Math.floor(Date.now() / 1000),
            user: {
                id: 12345,
                username: "invalid_sig",
            },
        });
        const tampered = `${initData}00`;
        expect(() => (0, telegramAuth_1.verifyTelegramData)(tampered)).toThrow("Invalid Telegram signature");
    });
    it("rejects expired auth_date", () => {
        const initData = createTelegramInitData({
            botToken,
            authDate: Math.floor(Date.now() / 1000) - 301,
            user: {
                id: 12345,
                username: "expired_user",
            },
        });
        expect(() => (0, telegramAuth_1.verifyTelegramData)(initData)).toThrow("Telegram authentication expired");
    });
});
