import { Router } from "express";
import { auth } from "../../shared/middlewares/auth.ts";
import { validate } from "../../shared/middlewares/validate.ts";
import * as projectMembersController from "./project-members.controller.ts";
import {
  createProjectMemberSchema,
  projectMembersQuerySchema,
  projectParamsSchema,
} from "./schemas/project-members.schema.ts";

export const projectMembersRouter = Router();

// 1. Listar miembros
// GET    /workspaces/:workspaceSlug/projects/:projectSlug/members
projectMembersRouter.get(
  "/workspaces/:workspaceSlug/projects/:projectSlug/members",
  auth,
  validate({ params: projectParamsSchema, query: projectMembersQuerySchema }),
  projectMembersController.findAll,
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

// No se puede modificar OWNER
// Solo OWNER o ADMIN

// 4. Eliminar miembro
// DELETE /workspaces/:workspaceSlug/projects/:projectSlug/members/:userId

// No se puede eliminar OWNER
// Solo OWNER o ADMIN
