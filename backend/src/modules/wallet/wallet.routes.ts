import { Router } from "express";
import { depositToWallet, getWallet, getWalletTransactions, withdrawFromWallet, getTransactions } from "./wallet.controller";
import { validateBody } from "../../middleware/validate";
import { walletAmountSchema } from "../../validators/wallet.validator";
import { rateLimitRedisMiddleware } from "../../middleware/rateLimitRedis";
import { requestAuditMiddleware } from "../../middleware/requestAudit.middleware";
import { replayProtectionMiddleware } from "../../middleware/replayProtection.middleware";
import { strictIdempotencyMiddleware } from "../../middleware/strictIdempotency.middleware";

const router = Router();

router.use(requestAuditMiddleware);

router.get("/", getWallet);
router.get("/transactions", getTransactions);
router.post(
	"/deposit",
	validateBody(walletAmountSchema),
	rateLimitRedisMiddleware,
	strictIdempotencyMiddleware,
	replayProtectionMiddleware,
	depositToWallet
);
router.post(
	"/withdraw",
	validateBody(walletAmountSchema),
	rateLimitRedisMiddleware,
	strictIdempotencyMiddleware,
	replayProtectionMiddleware,
	withdrawFromWallet
);

export default router;