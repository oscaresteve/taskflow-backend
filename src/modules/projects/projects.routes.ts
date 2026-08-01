import { Router } from "express";
import { auth } from "../../shared/middlewares/auth.ts";
import { validate } from "../../shared/middlewares/validate.ts";
import * as projectsController from "./projects.controller.ts";
import {
  createProjectSchema,
  projectQuerySchema,
  updateProjectSchema,
  projectParamsSchema,
  workspaceParamsSchema,
} from "./schemas/projects.schema.ts";

export const projectsRouter = Router();

// Validar el body, params, y query mediante middleware antes de pasar al controller.

// 1. Crear Proyecto
// POST   /workspaces/:workspaceSlug/projects
projectsRouter.post(
  "/workspaces/:workspaceSlug/projects",
  auth,
  validate({ params: workspaceParamsSchema, body: createProjectSchema }),
  projectsController.create,
);

// Solo si el usuario es OWNER o ADMIN
// Slug de proyecto unico dentro de su mismo workspace

// 2. Obtener todos los proyectos de un workspace
// GET    /workspaces/:workspaceSlug/projects
projectsRouter.get(
  "/workspaces/:workspaceSlug/projects",
  auth,
  validate({ params: workspaceParamsSchema, query: projectQuerySchema }),
  projectsController.findAll,
);

// Solo los proyectos de los cuales el usuario sea miembro
// Solo los proyectos que no esten archivados

// 3. Obtener un proyecto
// GET    /workspaces/:workspaceSlug/projects/:projectSlug
projectsRouter.get(
  "/workspaces/:workspaceSlug/projects/:projectSlug",
  auth,
  validate({ params: projectParamsSchema }),
  projectsController.findBySlug,
);

// 4. Actualizar un proyecto
// PATCH  /workspaces/:workspaceSlug/projects/:projectSlug
projectsRouter.patch(
  "/workspaces/:workspaceSlug/projects/:projectSlug",
  auth,
  validate({
    params: projectParamsSchema,
    body: updateProjectSchema,
  }),
  projectsController.update,
);

// La key no se puede actualizar, las tareas del proyecto perderian sentido

// 5. Archivar un proyecto
// PATCH  /workspaces/:workspaceSlug/projects/:projectSlug/archive
projectsRouter.patch(
  "/workspaces/:workspaceSlug/projects/:projectSlug/archive",
  auth,
  validate({ params: projectParamsSchema }),
  projectsController.archive,
);
