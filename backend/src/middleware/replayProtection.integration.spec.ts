// @ts-nocheck
import { replayProtectionMiddleware } from "./replayProtection.middleware";

jest.mock("../config/redis", () => ({
  redis: {
    status: "not-ready",
    setnx: jest.fn(),
    expire: jest.fn(),
  },
}));

jest.mock("../services/logger", () => ({
  logStructuredEvent: jest.fn().mockResolvedValue(undefined),
  logError: jest.fn().mockResolvedValue(undefined),
  logJackpotSkip: jest.fn().mockResolvedValue(undefined),
}));

function createReq() {
  return {
    baseUrl: "/api/game",
    path: "/open-box",
    headers: {},
    body: {
      boxId: "box-1",
      timestamp: Date.now(),
    },
    userId: "user-1",
  } as any;
}

function createRes() {
  const res: any = {};
  res.statusCode = 200;
  res.payload = null;
  res.status = jest.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn().mockImplementation((body: any) => {
    res.payload = body;
    return res;
  });
  return res;
}

describe("replay protection integration", () => {
  it("replay attack without idempotency key returns 409 on rapid duplicate", async () => {
    const req = createReq();
    const nextFirst = jest.fn();
    const nextSecond = jest.fn();

    const firstRes = createRes();
    await replayProtectionMiddleware(req, firstRes, nextFirst);

    expect(nextFirst).toHaveBeenCalledTimes(1);
    expect(firstRes.status).not.toHaveBeenCalledWith(409);

    const secondRes = createRes();
    await replayProtectionMiddleware(req, secondRes, nextSecond);

    expect(nextSecond).not.toHaveBeenCalled();
    expect(secondRes.status).toHaveBeenCalledWith(409);
    expect(secondRes.payload).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "REPLAY_ATTACK" }),
      })
    );
  });
});
