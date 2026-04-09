"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const mockPrisma = {
    idempotencyKey: {
        findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
};
jest.mock("../../config/db", () => ({
    prisma: mockPrisma,
}));
const game_service_1 = require("./game.service");
function d(value) {
    return new client_1.Prisma.Decimal(value);
}
function buildTx(args) {
    const reward = args.reward ?? 100;
    const state = {
        "user-1": {
            cashBalance: d(args.walletCash),
            bonusBalance: d(args.walletBonus),
        },
        "ref-1": {
            cashBalance: d(1000),
            bonusBalance: d(0),
        },
    };
    const transactionCreate = jest.fn().mockResolvedValue({});
    const tx = {
        box: {
            findUnique: jest.fn().mockResolvedValue({
                id: "box-1",
                price: d(args.boxPrice),
                rewardTable: [{ reward, probability: 1 }],
            }),
        },
        wallet: {
            findUnique: jest.fn().mockImplementation(async ({ where }) => {
                const wallet = state[where.userId];
                if (wallet) {
                    return {
                        userId: where.userId,
                        cashBalance: wallet.cashBalance,
                        bonusBalance: wallet.bonusBalance,
                    };
                }
                return null;
            }),
            updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
                const wallet = state[where.userId];
                if (!wallet) {
                    return { count: 0 };
                }
                wallet.cashBalance = data.cashBalance;
                wallet.bonusBalance = data.bonusBalance;
                return { count: 1 };
            }),
            update: jest.fn().mockImplementation(async ({ where, data }) => {
                const wallet = state[where.userId];
                if (!wallet) {
                    return null;
                }
                if (data?.cashBalance?.increment !== undefined) {
                    wallet.cashBalance = wallet.cashBalance.plus(d(data.cashBalance.increment));
                }
                if (data?.bonusBalance?.increment !== undefined) {
                    wallet.bonusBalance = wallet.bonusBalance.plus(d(data.bonusBalance.increment));
                }
                return {
                    userId: where.userId,
                    cashBalance: wallet.cashBalance,
                    bonusBalance: wallet.bonusBalance,
                };
            }),
        },
        transaction: {
            create: transactionCreate,
        },
        boxOpen: {
            count: jest.fn().mockResolvedValue(1),
            create: jest.fn().mockResolvedValue({}),
        },
        idempotencyKey: {
            create: jest.fn().mockResolvedValue({}),
        },
        user: {
            update: jest.fn().mockResolvedValue({
                paidBoxesOpened: 1,
                welcomeBonusUnlocked: false,
                referredBy: null,
            }),
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        vault: {
            findMany: jest.fn().mockResolvedValue([]),
        },
        userVault: {
            upsert: jest.fn(),
            update: jest.fn(),
        },
    };
    return { tx, state, transactionCreate };
}
describe("openBox wallet deduction", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPrisma.idempotencyKey.findUnique.mockResolvedValue(null);
    });
    async function runCase(input) {
        const { tx, state, transactionCreate } = buildTx({
            walletCash: input.cash,
            walletBonus: input.bonus,
            boxPrice: input.price,
        });
        mockPrisma.$transaction.mockImplementation(async (cb) => cb(tx));
        const reward = await (0, game_service_1.openBox)("user-1", "box-1", "idem-1");
        const purchaseCall = transactionCreate.mock.calls.find(([arg]) => arg?.data?.type === "BOX_PURCHASE");
        if (!purchaseCall) {
            throw new Error("BOX_PURCHASE transaction was not recorded");
        }
        const purchaseData = purchaseCall[0].data;
        return { reward, state, purchaseData };
    }
    it("CASE 1: cash only", async () => {
        const { reward, state, purchaseData } = await runCase({
            cash: 500,
            bonus: 100,
            price: 200,
        });
        expect(reward).toBe(100);
        expect(purchaseData.meta.cashUsed).toBe("200");
        expect(purchaseData.meta.bonusUsed).toBe("0");
        const totalDeduction = d(purchaseData.meta.cashUsed).plus(d(purchaseData.meta.bonusUsed));
        expect(totalDeduction.equals(d(200))).toBe(true);
        const expectedNewCashAfterReward = d(300).plus(d(100));
        expect(state["user-1"].cashBalance.equals(expectedNewCashAfterReward)).toBe(true);
        expect(state["user-1"].bonusBalance.equals(d(100))).toBe(true);
        expect(state["user-1"].cashBalance.greaterThanOrEqualTo(0)).toBe(true);
        expect(state["user-1"].bonusBalance.greaterThanOrEqualTo(0)).toBe(true);
    });
    it("CASE 2: cash + bonus", async () => {
        const { reward, state, purchaseData } = await runCase({
            cash: 100,
            bonus: 200,
            price: 250,
        });
        expect(reward).toBe(100);
        expect(purchaseData.meta.cashUsed).toBe("100");
        expect(purchaseData.meta.bonusUsed).toBe("150");
        const totalDeduction = d(purchaseData.meta.cashUsed).plus(d(purchaseData.meta.bonusUsed));
        expect(totalDeduction.equals(d(250))).toBe(true);
        const expectedNewCashAfterReward = d(0).plus(d(100));
        expect(state["user-1"].cashBalance.equals(expectedNewCashAfterReward)).toBe(true);
        expect(state["user-1"].bonusBalance.equals(d(50))).toBe(true);
        expect(state["user-1"].cashBalance.greaterThanOrEqualTo(0)).toBe(true);
        expect(state["user-1"].bonusBalance.greaterThanOrEqualTo(0)).toBe(true);
    });
    it("CASE 3: bonus only", async () => {
        const { reward, state, purchaseData } = await runCase({
            cash: 0,
            bonus: 300,
            price: 200,
        });
        expect(reward).toBe(100);
        expect(purchaseData.meta.cashUsed).toBe("0");
        expect(purchaseData.meta.bonusUsed).toBe("200");
        const totalDeduction = d(purchaseData.meta.cashUsed).plus(d(purchaseData.meta.bonusUsed));
        expect(totalDeduction.equals(d(200))).toBe(true);
        const expectedNewCashAfterReward = d(0).plus(d(100));
        expect(state["user-1"].cashBalance.equals(expectedNewCashAfterReward)).toBe(true);
        expect(state["user-1"].bonusBalance.equals(d(100))).toBe(true);
        expect(state["user-1"].cashBalance.greaterThanOrEqualTo(0)).toBe(true);
        expect(state["user-1"].bonusBalance.greaterThanOrEqualTo(0)).toBe(true);
    });
    it("CASE 4: exact match", async () => {
        const { reward, state, purchaseData } = await runCase({
            cash: 100,
            bonus: 100,
            price: 200,
        });
        expect(reward).toBe(100);
        expect(purchaseData.meta.cashUsed).toBe("100");
        expect(purchaseData.meta.bonusUsed).toBe("100");
        const totalDeduction = d(purchaseData.meta.cashUsed).plus(d(purchaseData.meta.bonusUsed));
        expect(totalDeduction.equals(d(200))).toBe(true);
        const expectedNewCashAfterReward = d(0).plus(d(100));
        expect(state["user-1"].cashBalance.equals(expectedNewCashAfterReward)).toBe(true);
        expect(state["user-1"].bonusBalance.equals(d(0))).toBe(true);
        expect(state["user-1"].cashBalance.greaterThanOrEqualTo(0)).toBe(true);
        expect(state["user-1"].bonusBalance.greaterThanOrEqualTo(0)).toBe(true);
    });
    it("CASE 5: insufficient balance", async () => {
        const { tx } = buildTx({
            walletCash: 50,
            walletBonus: 100,
            boxPrice: 200,
        });
        mockPrisma.$transaction.mockImplementation(async (cb) => cb(tx));
        await expect((0, game_service_1.openBox)("user-1", "box-1", "idem-1")).rejects.toThrow("Insufficient balance");
        expect(tx.transaction.create).not.toHaveBeenCalled();
    });
    it("returns the same reward for an already-used idempotency key", async () => {
        mockPrisma.idempotencyKey.findUnique.mockResolvedValue({
            userId: "user-1",
            rewardAmount: d(321),
        });
        const reward = await (0, game_service_1.openBox)("user-1", "box-1", "idem-replayed");
        expect(reward).toBe(321);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
    it("unlocks welcome bonus after 5 paid boxes", async () => {
        const { tx, transactionCreate } = buildTx({
            walletCash: 1000,
            walletBonus: 0,
            boxPrice: 100,
        });
        tx.user.update.mockResolvedValue({
            paidBoxesOpened: 5,
            welcomeBonusUnlocked: false,
            referredBy: null,
        });
        tx.user.updateMany.mockImplementation(async ({ where }) => {
            if (where?.welcomeBonusUnlocked === false) {
                return { count: 1 };
            }
            return { count: 0 };
        });
        mockPrisma.$transaction.mockImplementation(async (cb) => cb(tx));
        await (0, game_service_1.openBox)("user-1", "box-1", "idem-welcome");
        expect(tx.wallet.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { userId: "user-1" },
            data: { bonusBalance: { increment: 1000 } },
        }));
        const welcomeBonusTxn = transactionCreate.mock.calls.find(([arg]) => arg?.data?.type === "BOX_REWARD" && arg?.data?.amount === 1000);
        expect(welcomeBonusTxn).toBeTruthy();
    });
    it("triggers referral reward once on first paid box", async () => {
        const { tx, transactionCreate } = buildTx({
            walletCash: 1000,
            walletBonus: 0,
            boxPrice: 100,
        });
        tx.boxOpen.count.mockResolvedValue(0);
        tx.user.update.mockResolvedValue({
            paidBoxesOpened: 1,
            welcomeBonusUnlocked: false,
            referredBy: "ref-1",
        });
        tx.user.updateMany.mockImplementation(async ({ where }) => {
            if (where?.referredBy === "ref-1") {
                return { count: 1 };
            }
            return { count: 0 };
        });
        mockPrisma.$transaction.mockImplementation(async (cb) => cb(tx));
        await (0, game_service_1.openBox)("user-1", "box-1", "idem-referral");
        const referralTxn = transactionCreate.mock.calls.find(([arg]) => arg?.data?.type === "REFERRAL" && arg?.data?.userId === "ref-1");
        expect(referralTxn).toBeTruthy();
    });
    it("prevents referral reward abuse when referral already consumed", async () => {
        const { tx, transactionCreate } = buildTx({
            walletCash: 1000,
            walletBonus: 0,
            boxPrice: 100,
        });
        tx.boxOpen.count.mockResolvedValue(0);
        tx.user.update.mockResolvedValue({
            paidBoxesOpened: 1,
            welcomeBonusUnlocked: false,
            referredBy: "ref-1",
        });
        tx.user.updateMany.mockImplementation(async ({ where }) => {
            if (where?.referredBy === "ref-1") {
                return { count: 0 };
            }
            return { count: 0 };
        });
        mockPrisma.$transaction.mockImplementation(async (cb) => cb(tx));
        await (0, game_service_1.openBox)("user-1", "box-1", "idem-no-referral");
        const referralTxn = transactionCreate.mock.calls.find(([arg]) => arg?.data?.type === "REFERRAL");
        expect(referralTxn).toBeFalsy();
    });
});
describe("openFreeBox", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    function createFreeBoxTx(args) {
        let freeBoxUsed = args.alreadyUsed ?? false;
        const tx = {
            user: {
                findUnique: jest.fn().mockResolvedValue({
                    id: "user-1",
                    freeBoxUsed,
                    paidBoxesOpened: args.paidBoxesOpened,
                }),
                updateMany: jest.fn().mockImplementation(async () => {
                    if (freeBoxUsed) {
                        return { count: 0 };
                    }
                    freeBoxUsed = true;
                    return { count: 1 };
                }),
            },
            wallet: {
                findUnique: jest.fn().mockResolvedValue({
                    userId: "user-1",
                    cashBalance: d(500),
                    bonusBalance: d(200),
                }),
            },
            transaction: {
                create: jest.fn().mockResolvedValue({}),
            },
        };
        return tx;
    }
    it("allows free box only once", async () => {
        const tx = createFreeBoxTx({ paidBoxesOpened: 2 });
        mockPrisma.$transaction.mockImplementation(async (cb) => cb(tx));
        const first = await (0, game_service_1.openFreeBox)("user-1");
        expect(first.unlocked).toBe(false);
        await expect((0, game_service_1.openFreeBox)("user-1")).rejects.toThrow("Free box already used");
    });
    it("does not increase paid box progress", async () => {
        const tx = createFreeBoxTx({ paidBoxesOpened: 2 });
        mockPrisma.$transaction.mockImplementation(async (cb) => cb(tx));
        const result = await (0, game_service_1.openFreeBox)("user-1");
        expect(result.paidBoxesOpened).toBe(2);
        expect(result.paidBoxesRequired).toBe(5);
        expect(result.paidBoxesRemaining).toBe(3);
        expect(tx.user.updateMany).toHaveBeenCalledWith({
            where: {
                id: "user-1",
                freeBoxUsed: false,
            },
            data: { freeBoxUsed: true },
        });
    });
});
