import z from "zod";
import { TaskPriority } from "../types/tasks.types.ts";

export const workspaceSlugAndProjectSlugParamsSchema = z.object({
  workspaceSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug format is invalid"),
  projectSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug format is invalid"),
});

export const createTaskBodySchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Title must be at least 2 characters long")
    .max(100, "Title cannot exceed 100 characters"),
  description: z.string().trim().max(500, "Description cannot exceed 500 characters").optional(),
  priority: z.enum(TaskPriority),
  assigneeId: z.cuid2().optional(),
  dueDate: z.iso.datetime().optional(),
});

export type WorkspaceSlugAndProjectSlugDto = z.infer<typeof workspaceSlugAndProjectSlugParamsSchema>;
export type CreateTaskDto = z.infer<typeof createTaskBodySchema>;
