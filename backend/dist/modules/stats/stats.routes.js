"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stats_controller_1 = require("./stats.controller");
const router = (0, express_1.Router)();
router.get("/top-winners", stats_controller_1.getTopWinnersHandler);
exports.default = router;
