import { Router } from "express";
import { authRouter } from "../modules/auth/index.ts";
import { workspacesRouter } from "../modules/workspaces/index.ts";

export const router = Router();

router.use("/auth", authRouter);
router.use("/workspaces", workspacesRouter);