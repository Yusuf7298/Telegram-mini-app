import { Router } from "express";
import {
	claimVaultController,
	getUserVaultProgressController,
} from "./vault.controller";

const router = Router();

router.post("/claim", claimVaultController);
router.get("/:userId", getUserVaultProgressController);

export default router;