"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mockAuthWithTelegram = jest.fn();
const mockGenerateToken = jest.fn();
const mockVerifyTelegramData = jest.fn();
jest.mock("./auth.service", () => ({
    authWithTelegram: (...args) => mockAuthWithTelegram(...args),
    generateToken: (...args) => mockGenerateToken(...args),
}));
jest.mock("./telegramAuth", () => ({
    verifyTelegramData: (...args) => mockVerifyTelegramData(...args),
}));
const auth_controller_1 = require("./auth.controller");
function createResponseMock() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}
describe("telegramLogin", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it("returns token and user for successful login", async () => {
        const req = {
            body: { initData: "valid-init-data" },
        };
        const res = createResponseMock();
        const user = {
            id: "user-1",
            platformId: "12345",
            username: "john",
        };
        mockVerifyTelegramData.mockReturnValue(true);
        mockAuthWithTelegram.mockResolvedValue(user);
        mockGenerateToken.mockReturnValue("jwt-token");
        await (0, auth_controller_1.telegramLogin)(req, res);
        expect(mockVerifyTelegramData).toHaveBeenCalledWith("valid-init-data");
        expect(mockAuthWithTelegram).toHaveBeenCalledWith("valid-init-data");
        expect(mockGenerateToken).toHaveBeenCalledWith("user-1");
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: {
                token: "jwt-token",
                user,
            },
        });
    });
    it("rejects invalid Telegram signature", async () => {
        const req = {
            body: { initData: "bad-init-data" },
        };
        const res = createResponseMock();
        mockVerifyTelegramData.mockImplementation(() => {
            throw new Error("Invalid Telegram signature");
        });
        await (0, auth_controller_1.telegramLogin)(req, res);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: "Invalid Telegram signature",
        });
        expect(mockAuthWithTelegram).not.toHaveBeenCalled();
    });
    it("rejects expired Telegram auth_date", async () => {
        const req = {
            body: { initData: "expired-init-data" },
        };
        const res = createResponseMock();
        mockVerifyTelegramData.mockImplementation(() => {
            throw new Error("Telegram authentication expired");
        });
        await (0, auth_controller_1.telegramLogin)(req, res);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: "Telegram authentication expired",
        });
        expect(mockAuthWithTelegram).not.toHaveBeenCalled();
    });
});
