import { Router } from "express";
import { telegramLogin } from "./auth.controller";
import { rateLimitRedisMiddleware } from "../../middleware/rateLimitRedis";
import { validateBody } from "../../middleware/validate";
import { telegramLoginSchema } from "../../validators/auth.validator";

const router = Router();

router.post("/telegram-login", validateBody(telegramLoginSchema), rateLimitRedisMiddleware, telegramLogin);

export default router;
