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

export type CreateProjectDto = z.infer<typeof createProjectBodySchema>;
export type WorkspaceSlugParamsDto = z.infer<typeof workspaceSlugParamsSchema>;
