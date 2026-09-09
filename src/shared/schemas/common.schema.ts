import { z } from "zod";

// Slug con formato "palabra-palabra", usado en los params de workspaces, projects, etc.
export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug format is invalid");

// La query llega como string, no como en el body, asi que evitamos falsos booleans
export const booleanQueryParamSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();

export const searchSchema = z.string().trim().min(1).optional();

export const descriptionSchema = z.string().trim().max(500, "Description cannot exceed 500 characters").optional();

// Locales soportados por la app; unica fuente para no repetir el enum en cada schema que
// use locale (sign-up, update me, ...).
export const locales = ["en", "es"] as const;
export const localeSchema = z.enum(locales);

// Paginacion
export const pageSchema = z.coerce.number().int().positive().default(1);
export const limitSchema = z.coerce.number().int().positive().max(100).default(10);

// Ordenacion
export const sortOrderSchema = z.enum(["asc", "desc"]).default("asc");

// Params para acceder a un recurso, comunes a varios modulos
export const workspaceParamsSchema = z.object({
  workspaceSlug: slugSchema,
});

export const projectParamsSchema = workspaceParamsSchema.extend({
  projectSlug: slugSchema,
});

export const taskParamsSchema = projectParamsSchema.extend({
  taskNumber: z.coerce.number().int().positive("Task number must be positive"),
});

export const commentParamsSchema = taskParamsSchema.extend({
  commentId: z.cuid(),
});

export const workspaceMemberParamsSchema = workspaceParamsSchema.extend({
  userId: z.cuid(),
});

export const projectMemberParamsSchema = projectParamsSchema.extend({
  userId: z.cuid(),
});

export type WorkspaceParamsDto = z.infer<typeof workspaceParamsSchema>;
export type ProjectParamsDto = z.infer<typeof projectParamsSchema>;
export type TaskParamsDto = z.infer<typeof taskParamsSchema>;
export type CommentParamsDto = z.infer<typeof commentParamsSchema>;
export type WorkspaceMemberParamsDto = z.infer<typeof workspaceMemberParamsSchema>;
export type ProjectMemberParamsDto = z.infer<typeof projectMemberParamsSchema>;
