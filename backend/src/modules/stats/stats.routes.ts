import { Router } from "express";
import { getTopWinnersHandler } from "./stats.controller";

const router = Router();

router.get("/top-winners", getTopWinnersHandler);

export default router;
