import { Router } from "express";
import { auth } from "../../shared/middlewares/auth.ts";
import { validate } from "../../shared/middlewares/validate.ts";
import * as projectMembersController from "./project-members.controller.ts";
import {
  createProjectMemberSchema,
  projectMembersAllQuerySchema,
  projectMembersQuerySchema,
  updateProjectMemberSchema,
} from "./schemas/project-members.schema.ts";
import { projectMemberParamsSchema, projectParamsSchema } from "../../shared/schemas/common.schema.ts";

export const projectMembersRouter = Router();

// 1. Listar miembros
// GET    /workspaces/:workspaceSlug/projects/:projectSlug/members
projectMembersRouter.get(
  "/workspaces/:workspaceSlug/projects/:projectSlug/members",
  auth,
  validate({ params: projectParamsSchema, query: projectMembersQuerySchema }),
  projectMembersController.findAll,
);

// Listar miembros sin paginar
// GET    /workspaces/:workspaceSlug/projects/:projectSlug/members/all
projectMembersRouter.get(
  "/workspaces/:workspaceSlug/projects/:projectSlug/members/all",
  auth,
  validate({ params: projectParamsSchema, query: projectMembersAllQuerySchema }),
  projectMembersController.findAllUnpaginated,
);

// Obtener mi membership en el proyecto (para resolver mi rol sin paginar la lista completa)
// GET    /workspaces/:workspaceSlug/projects/:projectSlug/members/me
projectMembersRouter.get(
  "/workspaces/:workspaceSlug/projects/:projectSlug/members/me",
  auth,
  validate({ params: projectParamsSchema }),
  projectMembersController.findMe,
);

// 2. Añadir miembro
// POST   /workspaces/:workspaceSlug/projects/:projectSlug/members
projectMembersRouter.post(
  "/workspaces/:workspaceSlug/projects/:projectSlug/members",
  auth,
  validate({ params: projectParamsSchema, body: createProjectMemberSchema }),
  projectMembersController.create,
);

// Por defecto MEMBER
// Solo OWNER o ADMIN

// 3. Cambiar rol
// PATCH  /workspaces/:workspaceSlug/projects/:projectSlug/members/:userId
projectMembersRouter.patch(
  "/workspaces/:workspaceSlug/projects/:projectSlug/members/:userId",
  auth,
  validate({ params: projectMemberParamsSchema, body: updateProjectMemberSchema }),
  projectMembersController.update,
);

// No se puede modificar OWNER
// Solo OWNER o ADMIN

// 4. Eliminar miembro
// PATCH /workspaces/:workspaceSlug/projects/:projectSlug/members/:userId/deactivate
projectMembersRouter.patch(
  "/workspaces/:workspaceSlug/projects/:projectSlug/members/:userId/deactivate",
  auth,
  validate({ params: projectMemberParamsSchema }),
  projectMembersController.deactivate,
);

// No se puede eliminar OWNER
// Solo OWNER o ADMIN
