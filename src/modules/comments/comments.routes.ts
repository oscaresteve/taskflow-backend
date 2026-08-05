import { Router } from "express";
import * as commentsController from "./comments.controller.ts";
import { auth } from "../../shared/middlewares/auth.ts";
import { validate } from "../../shared/middlewares/validate.ts";
import { commentParamsSchema, taskParamsSchema } from "../../shared/schemas/common.schema.ts";
import { commentQuerySchema, createCommentSchema, updateCommentSchema } from "./schemas/comments.schema.ts";

export const commentsRouter = Router();

// 1. Obtener todos lo comentarios
// GET    /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/comments
commentsRouter.get(
  "/workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/comments",
  auth,
  validate({ params: taskParamsSchema, query: commentQuerySchema }),
  commentsController.findAll,
);

// Todos los miembros del proyecto

// 2. Crear un comentario
// POST   /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/comments
commentsRouter.post(
  "/workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/comments",
  auth,
  validate({ params: taskParamsSchema, body: createCommentSchema }),
  commentsController.create,
);

// Todos los miembros del proyecto

// 3. Actualizar un comenario
// PATCH  /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/comments/:commentId
commentsRouter.patch(
  "/workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/comments/:commentId",
  auth,
  validate({ params: commentParamsSchema, body: updateCommentSchema }),
  commentsController.update,
);

// Solo el autor

// 4. Eliminar un comentario
// PATCH /workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/comments/:commentId/delete
commentsRouter.patch(
  "/workspaces/:workspaceSlug/projects/:projectSlug/tasks/:taskNumber/comments/:commentId/delete",
  auth,
  validate({ params: commentParamsSchema }),
  commentsController.remove,
);

// Solo el autor, y OWNER o ADMIN del proyecto
