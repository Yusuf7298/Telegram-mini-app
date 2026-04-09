import { Router } from "express";
import { depositToWallet, getWallet, getWalletTransactions, withdrawFromWallet, getTransactions } from "./wallet.controller";
import { validateBody } from "../../middleware/validate";
import { walletAmountSchema } from "../../validators/wallet.validator";

const router = Router();

router.get("/", getWallet);
router.get("/transactions", getTransactions);
router.post("/deposit", validateBody(walletAmountSchema), depositToWallet);
router.post("/withdraw", validateBody(walletAmountSchema), withdrawFromWallet);

export default router;