"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRewardFromDB = generateRewardFromDB;
const assertDecimal_1 = require("../utils/assertDecimal");
const client_runtime_utils_1 = require("@prisma/client-runtime-utils");
const money_1 = require("../utils/money");
const rewardCache_1 = require("./rewardCache");
const logger_1 = require("./logger");
const crypto_1 = __importDefault(require("crypto"));
const gameConfig_service_1 = require("./gameConfig.service");
// RTP modifier integration
async function generateRewardFromDB(boxId, tx) {
    const MAX_ATTEMPTS = 5;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const rewards = await (0, rewardCache_1.getBoxRewards)(boxId, tx);
        if (!rewards.length) {
            // Fallback: return ₦0 reward
            return {
                amount: new client_runtime_utils_1.Decimal(0),
                category: 'No Win',
                label: 'No Reward',
            };
        }
        // Fetch RTP modifier
        const config = await (0, gameConfig_service_1.getValidatedGameConfig)({ client: tx, bypassCache: true });
        const rtpModifier = config.rtpModifier;
        // Adjust jackpot weights only
        const adjustedRewards = rewards.map(r => r.isJackpot ? { ...r, weight: Math.round(r.weight * rtpModifier) } : r);
        const totalWeight = adjustedRewards.reduce((sum, r) => (0, money_1.add)(sum, (0, money_1.D)(r.weight)), (0, money_1.D)(0));
        if (totalWeight.lte(0)) {
            return {
                amount: (0, money_1.D)(0),
                category: 'No Win',
                label: 'No Reward',
            };
        }
        let rand = crypto_1.default.randomInt(0, totalWeight.toNumber());
        let selected = adjustedRewards[0];
        for (const reward of adjustedRewards) {
            if (rand < reward.weight) {
                selected = reward;
                break;
            }
            rand -= reward.weight;
        }
        // Jackpot safety logic
        if (selected.isJackpot) {
            if (typeof selected.maxWinners === 'number' &&
                selected.currentWinners >= selected.maxWinners) {
                await (0, logger_1.logJackpotSkip)({
                    rewardId: selected.id,
                    currentWinners: selected.currentWinners,
                    maxWinners: selected.maxWinners,
                    boxId,
                    timestamp: new Date().toISOString(),
                });
                continue;
            }
            const updateResult = await tx.boxReward.updateMany({
                where: {
                    id: selected.id,
                    currentWinners: { lt: selected.maxWinners ?? 0 },
                },
                data: { currentWinners: { increment: 1 } },
            });
            if (updateResult.count === 0) {
                await (0, logger_1.logJackpotSkip)({
                    rewardId: selected.id,
                    currentWinners: selected.currentWinners,
                    maxWinners: selected.maxWinners,
                    boxId,
                    race: true,
                    timestamp: new Date().toISOString(),
                });
                continue;
            }
        }
        (0, assertDecimal_1.assertDecimal)(selected.reward, 'reward');
        return {
            amount: selected.reward,
            category: selected.category ?? null,
            label: selected.label ?? null,
        };
    }
    await (0, logger_1.logError)(new Error('Failed to select a valid reward after multiple attempts'), { boxId });
    (0, assertDecimal_1.assertDecimal)(new client_runtime_utils_1.Decimal(0), 'reward');
    return {
        amount: new client_runtime_utils_1.Decimal(0),
        category: 'No Win',
        label: 'No Reward',
    };
}
