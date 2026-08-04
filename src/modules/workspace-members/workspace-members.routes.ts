import { Router } from "express";
import { auth } from "../../shared/middlewares/auth.ts";
import { validate } from "../../shared/middlewares/validate.ts";
import * as workspaceMembersController from "./workspace-members.controller.ts";
import {
  createWorkspaceMemberSchema,
  workspaceMembersQuerySchema,
  workspaceParamsSchema,
} from "./schemas/workspace-members.schema.ts";

export const workspaceMembersRouter = Router();

// 1. Listar miembros
// GET    /workspaces/:workspaceSlug/members
workspaceMembersRouter.get(
  "/workspaces/:workspaceSlug/members",
  auth,
  validate({ params: workspaceParamsSchema, query: workspaceMembersQuerySchema }),
  workspaceMembersController.findAll,
);

// 2. Añadir miembro
// POST   /workspaces/:workspaceSlug/members
workspaceMembersRouter.post(
  "/workspaces/:workspaceSlug/members",
  auth,
  validate({ params: workspaceParamsSchema, body: createWorkspaceMemberSchema }),
  workspaceMembersController.create,
);

// Por defecto MEMBER
// Solo OWNER o ADMIN

// 3. Cambiar rol
// PATCH  /workspaces/:workspaceSlug/members/:userId

// No se puede modificar OWNER
// Solo OWNER o ADMIN

// 4. Eliminar miembro
// DELETE /workspaces/:workspaceSlug/members/:userId

// No se puede eliminar OWNER
// Solo OWNER o ADMIN
