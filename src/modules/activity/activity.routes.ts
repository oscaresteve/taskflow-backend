import { Router } from "express";
import * as activityController from "./activity.controller.ts";
import { auth } from "../../shared/middlewares/auth.ts";
import { validate } from "../../shared/middlewares/validate.ts";
import { projectParamsSchema, taskParamsSchema } from "../../shared/schemas/common.schema.ts";
import { activityQuerySchema } from "./schemas/activity.schema.ts";

export const activityRouter = Router();

// 1. Historial del proyecto
// GET    /workspaces/:workspaceSlug/projects/:projectSlug/activity
activityRouter.get(
  "/workspaces/:workspaceSlug/projects/:projectSlug/activity",
  auth,
  validate({ params: projectParamsSchema, query: activityQuerySchema }),
  activityController.findAllByProject,
);

// Todos los miembros del proyecto

// 2. Historial de una tarea
// GET    /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/activity
activityRouter.get(
  "/workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/activity",
  auth,
  validate({ params: taskParamsSchema, query: activityQuerySchema }),
  activityController.findAllByTask,
);

// Todos los miembros del proyecto
