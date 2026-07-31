import z from "zod";

export const createProjectBodySchema = z.object({
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

export const workspaceSlugParamsSchema = z.object({
  workspaceSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug format is invalid"),
});

const sortableFields = ["name", "createdAt", "updatedAt"] as const;

export const projectsQuerySchema = z.object({
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

export type CreateProjectDto = z.infer<typeof createProjectBodySchema>;
export type WorkspaceSlugParamsDto = z.infer<typeof workspaceSlugParamsSchema>;
export type ProjectsQueryDto = z.infer<typeof projectsQuerySchema>;
