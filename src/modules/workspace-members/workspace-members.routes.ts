import { Router } from "express";
import { auth } from "../../shared/middlewares/auth.ts";
import { validate } from "../../shared/middlewares/validate.ts";
import * as workspaceMembersController from "./workspace-members.controller.ts";
import {
  createWorkspaceMemberSchema,
  updateWorkspaceMemberSchema,
  workspaceMembersQuerySchema,
} from "./schemas/workspace-members.schema.ts";
import { workspaceMemberParamsSchema, workspaceParamsSchema } from "../../shared/schemas/common.schema.ts";

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

// Un OWNER puede asignar OWNER, ADMIN y MEMBER
// Un ADMIN puede asignar ADMIN, y MEMBER

// Activar miembros
// PATCH  /workspaces/:workspaceSlug/members/:userId/activate
workspaceMembersRouter.patch(
  "/workspaces/:workspaceSlug/members/:userId/activate",
  auth,
  validate({ params: workspaceMemberParamsSchema }),
  workspaceMembersController.activate,
);

// 3. Cambiar rol
// PATCH  /workspaces/:workspaceSlug/members/:userId
workspaceMembersRouter.patch(
  "/workspaces/:workspaceSlug/members/:userId",
  auth,
  validate({ params: workspaceMemberParamsSchema, body: updateWorkspaceMemberSchema }),
  workspaceMembersController.update,
);

// Un OWNER puede modificar OWNER, ADMIN y MEMBER
// Un ADMIN puede modificar ADMIN, y MEMBER

// 4. Eliminar miembro
// PATCH /workspaces/:workspaceSlug/members/:userId/remove
workspaceMembersRouter.patch(
  "/workspaces/:workspaceSlug/members/:userId/remove",
  auth,
  validate({ params: workspaceMemberParamsSchema }),
  workspaceMembersController.remove,
);

// No se puede eliminar OWNER
// Solo OWNER o ADMIN
