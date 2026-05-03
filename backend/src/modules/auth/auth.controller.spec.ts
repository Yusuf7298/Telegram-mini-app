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

jest.mock("../../services/alert.service", () => ({
  AlertService: {
    failedTelegramAuth: jest.fn(),
  },
}));

jest.mock("../../config/db", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(async ({ where }: any) => ({
        id: where.id,
        platformId: "12345",
        username: "john",
        role: "USER",
      })),
    },
  },
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
      ip: "127.0.0.1",
      headers: {
        "x-device-id": "device-123",
        "user-agent": "jest-agent",
      },
    } as unknown as Request;
    const res = createResponseMock();

    const user = {
      id: "user-1",
      platformId: "12345",
      username: "john",
      role: "USER",
    };

    mockVerifyTelegramData.mockReturnValue(true);
    mockAuthWithTelegram.mockResolvedValue(user);
    mockGenerateToken.mockReturnValue("jwt-token");

    await telegramLogin(req, res);

    expect(mockVerifyTelegramData).toHaveBeenCalledWith("valid-init-data");
    expect(mockAuthWithTelegram).toHaveBeenCalledWith("valid-init-data", {
      ip: "127.0.0.1",
      deviceId: "device-123",
      userAgent: "jest-agent",
    });
    expect(mockGenerateToken).toHaveBeenCalledWith("user-1", "USER");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        token: "jwt-token",
        user,
        referral: {
          attempted: false,
          applied: false,
          status: "not_provided",
        },
      },
      error: null,
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

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "REPLAY_ATTACK",
        message: "Invalid Telegram signature",
      },
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

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "REPLAY_ATTACK",
        message: "Telegram authentication expired",
      },
    });
    expect(mockAuthWithTelegram).not.toHaveBeenCalled();
  });
});
