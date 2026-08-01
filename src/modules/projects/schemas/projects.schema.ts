import z from "zod";

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
  description: z.string().trim().max(500, "Description cannot exceed 500 characters").optional(),
  icon: z.string("Icon must be a string").optional(),
  color: z.string("Color must be a string").optional(),
});

export const workspaceParamsSchema = z.object({
  workspaceSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug format is invalid"),
});

const sortableFields = ["name", "createdAt", "updatedAt"] as const;

export const projectQuerySchema = z.object({
  // Paginacion
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),

  // Filtros
  isArchived: z // Necesitamos hacer esta transformacion porque la query viene en string, no como en el body, asi evitar falsos booleans
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  search: z.string().trim().min(1).optional(),

  // Ordenacion
  sort: z.enum(sortableFields).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("asc"),
});

export const projectParamsSchema = z.object({
  workspaceSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug format is invalid"),
  projectSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug format is invalid"),
});

export const updateProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters long")
      .max(100, "Name cannot exceed 100 characters")
      .optional(),
    description: z.string().trim().max(500, "Description cannot exceed 500 characters").optional().nullable(),
    icon: z.string("Icon must be a string").optional().nullable(),
    color: z.string("Color must be a string").optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, "At least one field must be provided");
// Como todos los campos son opcionales se valida que al menos se envie un campo

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
export type WorkspaceParamsDto = z.infer<typeof workspaceParamsSchema>;
export type ProjectQueryDto = z.infer<typeof projectQuerySchema>;
export type ProjectParamsDto = z.infer<typeof projectParamsSchema>;
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
