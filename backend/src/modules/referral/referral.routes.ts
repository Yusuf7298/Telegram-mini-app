import { Router } from "express";
import { getReferralCode, useReferralCode } from "./referral.controller";
import { verifyTelegramAuth } from "../../middleware/telegramAuth.middleware";
import { validateBody } from "../../middleware/validate";
import { referralCodeSchema } from "../../validators/referral.validator";

const router = Router();

router.get("/code", verifyTelegramAuth, getReferralCode);
router.post(
	"/use",
	verifyTelegramAuth,
	validateBody(referralCodeSchema),
	useReferralCode
);

export default router;
