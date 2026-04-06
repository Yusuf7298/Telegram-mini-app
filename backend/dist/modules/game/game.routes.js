"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const game_controller_1 = require("./game.controller");
const game_rate_limit_middleware_1 = require("../../middleware/game-rate-limit.middleware");
const router = (0, express_1.Router)();
router.post("/open-box", game_rate_limit_middleware_1.openBoxRateLimit, game_controller_1.openBoxController);
router.post("/free-box", game_rate_limit_middleware_1.freeBoxRateLimit, game_controller_1.freeBoxController);
exports.default = router;
