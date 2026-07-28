import z from "zod";

export const createWorkspaceBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede superar los 100 caracteres"),

  description: z.string().trim().max(500, "La descripción no puede superar los 500 caracteres").optional(),

  logoUrl: z.string().url("La URL del logo no es válida").optional(),
});

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
  order: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateWorkspaceDto = z.infer<typeof createWorkspaceBodySchema>;
export type WorkspacesQueryDto = z.infer<typeof workspacesQuerySchema>;
