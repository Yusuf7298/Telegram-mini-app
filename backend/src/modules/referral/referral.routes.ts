import { Router } from "express";
import { getReferralCode, useReferralCode } from "./referral.controller";
import { verifyTelegramAuth } from "../../middleware/telegramAuth.middleware";
import { validateBody } from "../../middleware/validate";
import { referralCodeSchema } from "../../validators/referral.validator";
import { rateLimitRedisMiddleware } from "../../middleware/rateLimitRedis";

const router = Router();

router.get("/code", verifyTelegramAuth, getReferralCode);
router.post(
	"/use",
	verifyTelegramAuth,
	rateLimitRedisMiddleware,
	validateBody(referralCodeSchema),
	useReferralCode
);

export default router;
