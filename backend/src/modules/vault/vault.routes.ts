import { Router } from "express";
import {
	claimVaultController,
	getUserVaultProgressController,
} from "./vault.controller";
import { validateBody } from "../../middleware/validate";
import { claimVaultSchema } from "../../validators/vault.validator";

const router = Router();

router.post("/claim", validateBody(claimVaultSchema), claimVaultController);
router.get("/", getUserVaultProgressController);

export default router;