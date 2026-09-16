import { Router, type IRouter } from "express";
import healthRouter from "./health";
import christScrollRouter from "./christ-scroll";
import authRouter from "./auth";
import bookmarksRouter from "./bookmarks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(christScrollRouter);
router.use(authRouter);
router.use(bookmarksRouter);

export default router;
