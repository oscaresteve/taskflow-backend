import { z } from "zod";
import slugify from "../utils/slugify.ts";

// Slug con formato "palabra-palabra", usado en los params de workspaces, projects, etc.
export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug format is invalid");

// La query llega como string, no como en el body, asi que evitamos falsos booleans
export const booleanQueryParamSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();

export const searchSchema = z.string().trim().min(1).optional();

// El identificador publico con el que se menciona a alguien (@usuario).
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters long")
  .max(30, "Username cannot exceed 30 characters")
  .regex(/^[a-z0-9_]+$/, "Username can only contain lowercase letters, numbers and underscores");

// El nombre de un workspace o proyecto. Ademas del largo exige que deje algo slugificable: el slug
// sale del nombre y toda la API direcciona por slug, asi que un nombre que slugifica a "" crearia
// una fila que ninguna ruta podria volver a pedir.
export const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters long")
  .max(100, "Name cannot exceed 100 characters")
  .refine((value) => slugify(value) !== "", "Name must contain at least one letter or number");

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
