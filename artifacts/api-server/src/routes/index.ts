import { Router, type IRouter } from "express";
import healthRouter from "./health";
import christScrollRouter from "./christ-scroll";

const router: IRouter = Router();

router.use(healthRouter);
router.use(christScrollRouter);

export default router;
