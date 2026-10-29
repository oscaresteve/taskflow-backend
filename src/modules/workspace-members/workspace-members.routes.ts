import { Router } from "express";
import { auth } from "../../shared/middlewares/auth.ts";
import { validate } from "../../shared/middlewares/validate.ts";
import * as workspaceMembersController from "./workspace-members.controller.ts";
import {
  createWorkspaceMemberSchema,
  restoreWorkspaceMemberSchema,
  updateWorkspaceMemberSchema,
  workspaceMembersAllQuerySchema,
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

// Listar miembros sin paginar
// GET    /workspaces/:workspaceSlug/members/all
workspaceMembersRouter.get(
  "/workspaces/:workspaceSlug/members/all",
  auth,
  validate({ params: workspaceParamsSchema, query: workspaceMembersAllQuerySchema }),
  workspaceMembersController.findAllUnpaginated,
);

// Obtener mi membership en el workspace (para resolver mi rol sin paginar la lista completa)
// GET    /workspaces/:workspaceSlug/members/me
workspaceMembersRouter.get(
  "/workspaces/:workspaceSlug/members/me",
  auth,
  validate({ params: workspaceParamsSchema }),
  workspaceMembersController.findMe,
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

// 4b. Restaurar a un miembro eliminado
// Es la vuelta de /remove, no de /activate: ese sigue siendo solo para aceptar una invitacion
// pendiente. Lleva cuerpo porque la baja machaco el rol y hay que volver a elegirlo.
// PATCH /workspaces/:workspaceSlug/members/:userId/restore
workspaceMembersRouter.patch(
  "/workspaces/:workspaceSlug/members/:userId/restore",
  auth,
  validate({ params: workspaceMemberParamsSchema, body: restoreWorkspaceMemberSchema }),
  workspaceMembersController.restore,
);

// No se puede eliminar OWNER
// Solo OWNER o ADMIN

// 5. Salir del workspace
// PATCH /workspaces/:workspaceSlug/members/me/leave
workspaceMembersRouter.patch(
  "/workspaces/:workspaceSlug/members/me/leave",
  auth,
  validate({ params: workspaceParamsSchema }),
  workspaceMembersController.leave,
);
