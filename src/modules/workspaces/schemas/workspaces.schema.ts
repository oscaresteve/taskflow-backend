import z from "zod";
import {
  descriptionSchema,
  limitSchema,
  pageSchema,
  searchSchema,
  sortOrderSchema,
} from "../../../shared/schemas/common.schema.ts";

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters long")
    .max(100, "Name cannot exceed 100 characters"),
  description: descriptionSchema,
  logoUrl: z.url("Logo URL must be a valid URL").optional(),
});

export const updateWorkspaceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters long")
      .max(100, "Name cannot exceed 100 characters")
      .optional(),
    description: descriptionSchema.nullable(),
    // Nullable para permitir borrar el contenido ya que este es opcional
    logoUrl: z.url("Logo URL must be a valid URL").optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, "At least one field must be provided");
// Como todos los campos son opcionales se valida que al menos se envie un campo

const sortableFields = ["name", "createdAt", "updatedAt"] as const;

const isActiveQueryParamSchema = z.enum(["true", "false"]).transform((value) => value === "true");

export const workspaceQuerySchema = z.object({
  // Paginacion
  page: pageSchema,
  limit: limitSchema,

  // Filtros
  // Acepta un isActive ("?isActive=true") o varios ("?isActive=true&isActive=false").
  isActive: z.union([isActiveQueryParamSchema, z.array(isActiveQueryParamSchema)]).optional(),
  search: searchSchema,

  // Ordenacion
  sort: z.enum(sortableFields).default("createdAt"),
  order: sortOrderSchema,
});

export type CreateWorkspaceDto = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceDto = z.infer<typeof updateWorkspaceSchema>;
export type WorkspaceQueryDto = z.infer<typeof workspaceQuerySchema>;
