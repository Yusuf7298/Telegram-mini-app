"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const config_controller_1 = require("./config.controller");
const router = (0, express_1.Router)();
router.get("/game", config_controller_1.getGameConfig);
exports.default = router;
