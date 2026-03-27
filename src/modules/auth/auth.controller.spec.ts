import { Request, Response } from "express";

const mockAuthWithTelegram = jest.fn();
const mockGenerateToken = jest.fn();
const mockVerifyTelegramData = jest.fn();

jest.mock("./auth.service", () => ({
  authWithTelegram: (...args: unknown[]) => mockAuthWithTelegram(...args),
  generateToken: (...args: unknown[]) => mockGenerateToken(...args),
}));

jest.mock("./telegramAuth", () => ({
  verifyTelegramData: (...args: unknown[]) => mockVerifyTelegramData(...args),
}));

import { telegramLogin } from "./auth.controller";

function createResponseMock() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe("telegramLogin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns token and user for successful login", async () => {
    const req = {
      body: { initData: "valid-init-data" },
    } as Request;
    const res = createResponseMock();

    const user = {
      id: "user-1",
      platformId: "12345",
      username: "john",
    };

    mockVerifyTelegramData.mockReturnValue(true);
    mockAuthWithTelegram.mockResolvedValue(user);
    mockGenerateToken.mockReturnValue("jwt-token");

    await telegramLogin(req, res);

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
    } as Request;
    const res = createResponseMock();

    mockVerifyTelegramData.mockImplementation(() => {
      throw new Error("Invalid Telegram signature");
    });

    await telegramLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid Telegram signature",
    });
    expect(mockAuthWithTelegram).not.toHaveBeenCalled();
  });

  it("rejects expired Telegram auth_date", async () => {
    const req = {
      body: { initData: "expired-init-data" },
    } as Request;
    const res = createResponseMock();

    mockVerifyTelegramData.mockImplementation(() => {
      throw new Error("Telegram authentication expired");
    });

    await telegramLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Telegram authentication expired",
    });
    expect(mockAuthWithTelegram).not.toHaveBeenCalled();
  });
});
