import { Router } from "express";
import { auth } from "../../shared/middlewares/auth.ts";
import { validate } from "../../shared/middlewares/validate.ts";
import * as workspacesController from "./workspaces.controller.ts";
import { createWorkspaceSchema, workspaceQuerySchema, updateWorkspaceSchema } from "./schemas/workspaces.schema.ts";
import { workspaceParamsSchema } from "../../shared/schemas/common.schema.ts";

export const workspacesRouter = Router();

// Validar el body, params, y query mediante middleware antes de pasar al controller.

// 1. Crear Workspace
// POST /workspaces

// El usuario debe estar autenticado.
// El slug debe generarse automáticamente (no confiar en el frontend).
// Crear el Workspace.
// Crear automáticamente el WorkspaceMember con rol OWNER y estado ACTIVE.
// Devolver el Workspace creado.

workspacesRouter.post("/workspaces", auth, validate({ body: createWorkspaceSchema }), workspacesController.create);

// 2. Listar mis Workspaces
// GET /workspaces
workspacesRouter.get("/workspaces", auth, validate({ query: workspaceQuerySchema }), workspacesController.findAll);

// No devuelve todos.
// Solo aquellos en los que el usuario pertenece.

// 3. Obtener un Workspace
// GET /workspaces/:workspaceSlug
workspacesRouter.get(
  "/workspaces/:workspaceSlug",
  auth,
  validate({ params: workspaceParamsSchema }),
  workspacesController.findBySlug,
);

// Solo si el usuario pertenece a ese Workspace.

// 4. Actualizar Workspace
// PATCH /workspaces/:workspaceSlug
workspacesRouter.patch(
  "/workspaces/:workspaceSlug",
  auth,
  validate({ params: workspaceParamsSchema, body: updateWorkspaceSchema }),
  workspacesController.update,
);

// Solo el OWNER o un ADMIN (según la política que definas).

// 5. Archivar o eliminar
// En lugar de implementar un DELETE físico, utilizar el campo isActive.
// PATCH /workspaces/:workspaceSlug/deactivate
workspacesRouter.patch(
  "/workspaces/:workspaceSlug/deactivate",
  auth,
  validate({ params: workspaceParamsSchema }),
  workspacesController.deactivate,
);
