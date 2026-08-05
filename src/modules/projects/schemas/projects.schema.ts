import z from "zod";
import {
  booleanQueryParamSchema,
  descriptionSchema,
  limitSchema,
  pageSchema,
  searchSchema,
  sortOrderSchema,
} from "../../../shared/schemas/common.schema.ts";

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters long")
    .max(100, "Name cannot exceed 100 characters"),
  key: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .regex(/^[A-Z0-9]+$/, "Key must contain only uppercase letters and numbers"),
  description: descriptionSchema,
  icon: z.string("Icon must be a string").optional(),
  color: z.string("Color must be a string").optional(),
});

const sortableFields = ["name", "createdAt", "updatedAt"] as const;

export const projectQuerySchema = z.object({
  // Paginacion
  page: pageSchema,
  limit: limitSchema,

  // Filtros
  isArchived: booleanQueryParamSchema,
  search: searchSchema,

  // Ordenacion
  sort: z.enum(sortableFields).default("createdAt"),
  order: sortOrderSchema,
});

export const updateProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters long")
      .max(100, "Name cannot exceed 100 characters")
      .optional(),
    description: descriptionSchema.nullable(),
    icon: z.string("Icon must be a string").optional().nullable(),
    color: z.string("Color must be a string").optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, "At least one field must be provided");
// Como todos los campos son opcionales se valida que al menos se envie un campo

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
export type ProjectQueryDto = z.infer<typeof projectQuerySchema>;
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
