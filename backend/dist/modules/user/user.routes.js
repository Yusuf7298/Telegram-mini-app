"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("./user.controller");
const router = (0, express_1.Router)();
router.post("/register", user_controller_1.registerUser);
router.get("/", user_controller_1.getCurrentUser);
router.get("/referrals", user_controller_1.getReferrals);
exports.default = router;
