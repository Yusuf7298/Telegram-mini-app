"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBoxRewardInput = validateBoxRewardInput;
const client_1 = require("@prisma/client");
const money_1 = require("../utils/money");
function validateBoxRewardInput(data) {
    try {
        data.weight = new client_1.Prisma.Decimal(data.weight);
    }
    catch {
        throw new Error('Weight must be a valid decimal value.');
    }
    try {
        data.reward = new client_1.Prisma.Decimal(data.reward);
    }
    catch {
        throw new Error('Reward must be a valid decimal value.');
    }
    if ((0, money_1.lte)(data.weight, (0, money_1.D)(0))) {
        throw new Error('Weight must be a positive number.');
    }
    if ((0, money_1.lt)(data.reward, (0, money_1.D)(0))) {
        throw new Error('Reward must be greater than or equal to 0.');
    }
    if (data.isJackpot) {
        try {
            data.maxWinners = new client_1.Prisma.Decimal(data.maxWinners);
        }
        catch {
            throw new Error('maxWinners must be a valid decimal value.');
        }
        if ((0, money_1.lte)(data.maxWinners, (0, money_1.D)(0))) {
            throw new Error('Jackpot rewards must have maxWinners > 0.');
        }
    }
    if (typeof data.category === 'string') {
        data.category = data.category.trim();
    }
    if (typeof data.label === 'string') {
        data.label = data.label.trim();
    }
}
