import { Router } from "express";
import { auth } from "../../shared/middlewares/auth.ts";
import { validate } from "../../shared/middlewares/validate.ts";
import * as overviewController from "./overview.controller.ts";
import { projectParamsSchema, workspaceParamsSchema } from "../../shared/schemas/common.schema.ts";

export const overviewRouter = Router();

// 1. Resumen del propio usuario ("My Space")
// GET    /me/overview
overviewRouter.get("/me/overview", auth, overviewController.findMyOverview);

// 2. Resumen de un workspace
// GET    /workspaces/:workspaceSlug/overview
overviewRouter.get(
  "/workspaces/:workspaceSlug/overview",
  auth,
  validate({ params: workspaceParamsSchema }),
  overviewController.findWorkspaceOverview,
);

// 3. Resumen de un proyecto
// GET    /workspaces/:workspaceSlug/projects/:projectSlug/overview
overviewRouter.get(
  "/workspaces/:workspaceSlug/projects/:projectSlug/overview",
  auth,
  validate({ params: projectParamsSchema }),
  overviewController.findProjectOverview,
);
