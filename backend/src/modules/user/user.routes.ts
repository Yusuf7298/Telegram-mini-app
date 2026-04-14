import { Router } from "express";
import { getCurrentUser, getReferrals, registerUser } from "./user.controller";
import { validateBody } from "../../middleware/validate";
import { registerUserSchema } from "../../validators/user.validator";

const router = Router();

router.post("/register", validateBody(registerUserSchema), registerUser);
router.get("/", getCurrentUser);
router.get("/referrals", getReferrals);

export default router;