import { Router } from "express";
import { openBoxController, freeBoxController } from "./game.controller";

const router = Router();

router.post("/open-box", openBoxController);
router.post("/free-box", freeBoxController);

export default router;