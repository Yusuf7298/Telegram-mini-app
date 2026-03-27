"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vault_controller_1 = require("./vault.controller");
const router = (0, express_1.Router)();
router.post("/claim", vault_controller_1.claimVaultController);
router.get("/", vault_controller_1.getUserVaultProgressController);
exports.default = router;
