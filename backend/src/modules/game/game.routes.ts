import { Router } from "express";
import { getBoxesController, openBoxController, freeBoxController } from "./game.controller";
import { rateLimitRedisMiddleware } from "../../middleware/rateLimitRedis";
import { replayProtectionMiddleware } from "../../middleware/replayProtection.middleware";
import { validateBody } from "../../middleware/validate";
import { freeBoxSchema, openBoxSchema } from "../../validators/game.validator";
import { authMiddleware } from "../../middleware/auth.middleware";
import { requestAuditMiddleware } from "../../middleware/requestAudit.middleware";
import { strictIdempotencyMiddleware } from "../../middleware/strictIdempotency.middleware";

const router = Router();

router.use(requestAuditMiddleware);

router.get("/boxes", getBoxesController);
router.post(
	"/open-box",
	authMiddleware,
	rateLimitRedisMiddleware,
	strictIdempotencyMiddleware,
	replayProtectionMiddleware,
	validateBody(openBoxSchema),
	openBoxController
);
router.post(
	"/free-box",
	authMiddleware,
	rateLimitRedisMiddleware,
	strictIdempotencyMiddleware,
	replayProtectionMiddleware,
	validateBody(freeBoxSchema),
	freeBoxController
);

export default router;