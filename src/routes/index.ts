import { Router } from "express";
import { authRouter } from "../modules/auth/index.ts";
import { workspacesRouter } from "../modules/workspaces/index.ts";
import { projectsRouter } from "../modules/projects/index.ts";
import { tasksRouter } from "../modules/tasks/index.ts";

export const router = Router();

router.use("/auth", authRouter);
router.use(workspacesRouter);
router.use(projectsRouter);
router.use(tasksRouter);
