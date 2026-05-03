"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReward = generateReward;
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
function applyOnboardingRtpControl(reward, boxPrice, onboardingRtpModifier, maxPayoutMultiplier) {
    const factor = new client_1.Prisma.Decimal(onboardingRtpModifier);
    const maxSafeReward = boxPrice.mul(maxPayoutMultiplier);
    const adjusted = reward.mul(factor);
    return adjusted.gt(maxSafeReward) ? maxSafeReward : adjusted;
}
function generateReward(config, context) {
    if (context.kind === "referral_activation") {
        return config.referralRewardAmount;
    }
    const rolledReward = new client_1.Prisma.Decimal(crypto_1.default.randomInt(config.minBoxReward, config.maxBoxReward));
    if (context.kind === "open_box" && context.isOnboarding) {
        const onboardingFactor = Math.max(config.minRtpModifier.toNumber(), Math.min(config.rtpModifier, config.maxRtpModifier.toNumber()));
        return applyOnboardingRtpControl(rolledReward, context.boxPrice, onboardingFactor, config.maxPayoutMultiplier);
    }
    return rolledReward;
}
