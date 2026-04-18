"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rewards_controller_1 = require("./rewards.controller");
const router = (0, express_1.Router)();
router.get("/daily-status", rewards_controller_1.getDailyRewardStatusHandler);
router.post("/daily-claim", rewards_controller_1.claimDailyRewardHandler);
router.get("/win-history", rewards_controller_1.getWinHistoryHandler);
exports.default = router;
