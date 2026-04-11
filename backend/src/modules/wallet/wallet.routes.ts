import { Router } from "express";
import { depositToWallet, getWallet, getWalletTransactions, withdrawFromWallet, getTransactions } from "./wallet.controller";
import { validateBody } from "../../middleware/validate";
import { walletAmountSchema } from "../../validators/wallet.validator";
import { rateLimitRedisMiddleware } from "../../middleware/rateLimitRedis";

const router = Router();

router.get("/", getWallet);
router.get("/transactions", getTransactions);
router.post("/deposit", validateBody(walletAmountSchema), depositToWallet);
router.post("/withdraw", validateBody(walletAmountSchema), rateLimitRedisMiddleware, withdrawFromWallet);

export default router;