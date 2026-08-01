import { Router } from "express";
import { validate } from "../../shared/middlewares/validate.ts";
import { auth } from "../../shared/middlewares/auth.ts";
import * as tasksController from "./tasks.controller.ts";
import { createTaskBodySchema, workspaceSlugAndProjectSlugParamsSchema } from "./schemas/tasks.schema.ts";

export const tasksRouter = Router();

// 1. Crear tarea
// POST   /workspaces/:workspaceSlug/projects/:projectSlug/tasks
tasksRouter.post(
  "/workspaces/:workspaceSlug/projects/:projectSlug/tasks",
  auth,
  validate({ params: workspaceSlugAndProjectSlugParamsSchema, body: createTaskBodySchema }),
  tasksController.create,
);

// Aumentar el nextTaskNumber del proyecto al crear una tarea
// Calcular la nueva posicion de la tarea

// 2. Obtener todas las tareas
// GET    /workspaces/:workspaceSlug/projects/:projectSlug/tasks

// 3. Obtener una tarea
// GET    /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber

// 4. Actualizar tarea
// PATCH  /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber

// 5. Archivar tarea
// PATCH  /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/archive
