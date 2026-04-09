import { Router } from "express";
import { getBoxesController, openBoxController, freeBoxController } from "./game.controller";
import { rateLimitRedisMiddleware } from "../../middleware/rateLimitRedis";
import { replayProtectionMiddleware } from "../../middleware/replayProtection.middleware";
import { validateBody } from "../../middleware/validate";
import { openBoxSchema } from "../../validators/game.validator";

const router = Router();

router.get("/boxes", getBoxesController);
router.post(
	"/open-box",
	validateBody(openBoxSchema),
	rateLimitRedisMiddleware,
	replayProtectionMiddleware,
	openBoxController
);
router.post("/free-box", freeBoxController);

export default router;