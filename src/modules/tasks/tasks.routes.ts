import { Router } from "express";
import { validate } from "../../shared/middlewares/validate.ts";
import { auth } from "../../shared/middlewares/auth.ts";
import * as tasksController from "./tasks.controller.ts";
import {
  createTaskSchema,
  projectParamsSchema,
  taskParamsSchema,
  taskQuerySchema,
  updateTaskSchema,
} from "./schemas/tasks.schema.ts";

export const tasksRouter = Router();

// 1. Crear tarea
// POST   /workspaces/:workspaceSlug/projects/:projectSlug/tasks
tasksRouter.post(
  "/workspaces/:workspaceSlug/projects/:projectSlug/tasks",
  auth,
  validate({ params: projectParamsSchema, body: createTaskSchema }),
  tasksController.create,
);

// Aumentar el nextTaskNumber del proyecto al crear una tarea
// Calcular la nueva posicion de la tarea

// 2. Obtener todas las tareas
// GET    /workspaces/:workspaceSlug/projects/:projectSlug/tasks
tasksRouter.get(
  "/workspaces/:workspaceSlug/projects/:projectSlug/tasks",
  auth,
  validate({
    query: taskQuerySchema,
    params: projectParamsSchema,
  }),
  tasksController.findAll,
);

// 3. Obtener una tarea
// GET    /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber
tasksRouter.get(
  "/workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber",
  auth,
  validate({ params: taskParamsSchema }),
  tasksController.findByTaskNumber,
);

// 4. Actualizar tarea
// PATCH  /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber
tasksRouter.patch(
  "/workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber",
  auth,
  validate({
    params: taskParamsSchema,
    body: updateTaskSchema,
  }),
  tasksController.update,
);

// 5. Archivar tarea
// PATCH  /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/archive
tasksRouter.patch(
  "/workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/archive",
  auth,
  validate({ params: taskParamsSchema }),
  tasksController.archive,
);
