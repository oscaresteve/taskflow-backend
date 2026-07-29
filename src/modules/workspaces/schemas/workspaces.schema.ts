import z from "zod";

export const createWorkspaceBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters long")
    .max(100, "Name cannot exceed 100 characters"),
  description: z.string().trim().max(500, "Description cannot exceed 500 characters").optional(),
  logoUrl: z.url("Logo URL must be a valid URL").optional(),
});

export const updateWorkspaceBodySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters long")
      .max(100, "Name cannot exceed 100 characters")
      .optional(),
    description: z.string().trim().max(500, "Description cannot exceed 500 characters").optional().nullable(),
    // Nullable para permitir borrar el contenido ya que este es opcional
    logoUrl: z.url("Logo URL must be a valid URL").optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, "At least one field must be provided");
// Como todos los campos son opcionales se valida que al menos se envie un campo

const sortableFields = ["name", "createdAt", "updatedAt"] as const;

export const workspacesQuerySchema = z.object({
  // Paginacion
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),

  // Filtros
  isActive: z // Necesitamos hacer esta transformacion porque la query viene en string, no como en el body, asi evitar falsos booleans
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  search: z.string().trim().min(1).optional(),

  // Ordenacion
  sort: z.enum(sortableFields).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("asc"),
});

export const workspacesSlugParamsSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug format is invalid"),
});

export type CreateWorkspaceDto = z.infer<typeof createWorkspaceBodySchema>;
export type UpdateWorkspaceDto = z.infer<typeof updateWorkspaceBodySchema>;
export type WorkspacesQueryDto = z.infer<typeof workspacesQuerySchema>;
export type WorkspacesSlugParamsDto = z.infer<typeof workspacesSlugParamsSchema>;
