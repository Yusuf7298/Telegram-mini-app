"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wallet_controller_1 = require("./wallet.controller");
const router = (0, express_1.Router)();
router.get("/", wallet_controller_1.getWallet);
exports.default = router;
