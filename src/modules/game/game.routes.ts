import { Router } from "express";
import { openBoxController, freeBoxController } from "./game.controller";
import {
	freeBoxRateLimit,
	openBoxRateLimit,
} from "../../middleware/game-rate-limit.middleware";

const router = Router();

router.post("/open-box", openBoxRateLimit, openBoxController);
router.post("/free-box", freeBoxRateLimit, freeBoxController);

export default router;