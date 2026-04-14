// @ts-nocheck
import express from "express";
import request from "supertest";

const walletState = {
  cashBalance: 1000,
  bonusBalance: 0,
  airtimeBalance: 0,
};

jest.mock("../auth/auth.service", () => ({
  authWithTelegram: jest.fn(async () => ({
    id: "user-1",
    platformId: "tg-123",
    username: "tester",
  })),
  generateToken: jest.fn((userId: string) => `token-${userId}`),
}));

jest.mock("../auth/telegramAuth", () => ({
  verifyTelegramData: jest.fn(() => true),
}));

jest.mock("../../services/alert.service", () => ({
  AlertService: {
    failedTelegramAuth: jest.fn(),
  },
}));

jest.mock("../game/game.service", () => ({
  openBox: jest.fn(async (_userId: string, _boxId: string, _idempotencyKey: string) => {
    const boxPrice = 100;
    const reward = 20;

    walletState.cashBalance = walletState.cashBalance - boxPrice + reward;

    return {
      success: true,
      data: {
        reward,
        wallet: { ...walletState },
      },
      error: null,
    };
  }),
  openFreeBox: jest.fn(),
  getBoxes: jest.fn(),
}));

jest.mock("../wallet/wallet.service", () => ({
  depositWallet: jest.fn(),
  withdrawWallet: jest.fn(async (_userId: string, amount: any, _idempotencyKey: string) => {
    const numericAmount = Number(amount?.toString?.() ?? amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new Error("Invalid withdraw amount");
    }

    if (walletState.cashBalance < numericAmount) {
      throw new Error("Insufficient withdrawable balance");
    }

    walletState.cashBalance -= numericAmount;

    return {
      success: true,
      data: { ...walletState },
      error: null,
    };
  }),
}));

import { telegramLogin } from "../auth/auth.controller";
import { openBoxController } from "../game/game.controller";
import { withdrawFromWallet } from "../wallet/wallet.controller";

function withAuthUser(req: express.Request, _res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer token-")) {
    req.userId = header.replace("Bearer token-", "");
  }
  next();
}

describe("integration: login -> open box -> withdraw -> wallet update", () => {
  beforeEach(() => {
    walletState.cashBalance = 1000;
    walletState.bonusBalance = 0;
    walletState.airtimeBalance = 0;
  });

  it("completes flow and updates wallet balance correctly", async () => {
    const app = express();
    app.use(express.json());

    app.post("/auth/telegram-login", telegramLogin);
    app.post("/game/open-box", withAuthUser, openBoxController);
    app.post("/wallet/withdraw", withAuthUser, withdrawFromWallet);
    app.get("/wallet", withAuthUser, (_req, res) => {
      return res.status(200).json({
        success: true,
        data: { ...walletState },
        error: null,
      });
    });

    const loginRes = await request(app)
      .post("/auth/telegram-login")
      .send({ initData: "valid-telegram-init-data" });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body?.success).toBe(true);

    const token = loginRes.body?.data?.token;
    expect(typeof token).toBe("string");

    const openBoxRes = await request(app)
      .post("/game/open-box")
      .set("Authorization", `Bearer ${token}`)
      .send({
        boxId: "box-1",
        idempotencyKey: "idem-open-1",
        timestamp: Date.now(),
      });

    expect(openBoxRes.status).toBe(200);
    expect(openBoxRes.body?.success).toBe(true);
    expect(openBoxRes.body?.data?.wallet?.cashBalance).toBe(920);

    const withdrawRes = await request(app)
      .post("/wallet/withdraw")
      .set("Authorization", `Bearer ${token}`)
      .send({
        amount: 200,
        idempotencyKey: "idem-withdraw-1",
      });

    expect(withdrawRes.status).toBe(200);
    expect(withdrawRes.body?.success).toBe(true);
    expect(withdrawRes.body?.data?.cashBalance).toBe(720);

    const walletRes = await request(app)
      .get("/wallet")
      .set("Authorization", `Bearer ${token}`);

    expect(walletRes.status).toBe(200);
    expect(walletRes.body?.success).toBe(true);
    expect(walletRes.body?.data).toEqual({
      cashBalance: 720,
      bonusBalance: 0,
      airtimeBalance: 0,
    });
  });
});
