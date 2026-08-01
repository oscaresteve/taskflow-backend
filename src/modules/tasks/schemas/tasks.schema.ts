import z from "zod";
import { TaskPriority, TaskStatus } from "../types/tasks.types.ts";

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
  assigneeId: z.cuid().optional(),
  dueDate: z.iso.datetime().optional(),
});

const sortableFields = ["position", "title", "status", "priority", "dueDate", "createdAt", "updatedAt"] as const;

export const tasksQuerySchema = z.object({
  // Pagination
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),

  // Filters
  isArchived: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),

  search: z.string().trim().min(1).optional(),

  status: z.enum(TaskStatus).optional(),

  priority: z.enum(TaskPriority).optional(),

  assigneeId: z.cuid().optional(),

  // Sorting
  sort: z.enum(sortableFields).default("position"),
  order: z.enum(["asc", "desc"]).default("asc"),
});

export const workspaceSlugAndProjectSlugAndTaskNumberParamsSchema = z.object({
  workspaceSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug format is invalid"),
  projectSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug format is invalid"),
  taskNumber: z.coerce.number().int().positive("Task number must be positive"),
});

export type WorkspaceSlugAndProjectSlugDto = z.infer<typeof workspaceSlugAndProjectSlugParamsSchema>;
export type CreateTaskDto = z.infer<typeof createTaskBodySchema>;
export type TasksQueryDto = z.infer<typeof tasksQuerySchema>;
export type WorkspaceSlugAndProjectSlugAndTaskNumberDto = z.infer<
  typeof workspaceSlugAndProjectSlugAndTaskNumberParamsSchema
>;
