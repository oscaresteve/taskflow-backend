import z from "zod";
import { TaskPriority, TaskStatus } from "../../../shared/types/prisma.types.ts";

export const projectParamsSchema = z.object({
  workspaceSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug format is invalid"),
  projectSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug format is invalid"),
});

export const createTaskSchema = z.object({
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

export const taskQuerySchema = z.object({
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

export const taskParamsSchema = z.object({
  workspaceSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug format is invalid"),
  projectSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug format is invalid"),
  taskNumber: z.coerce.number().int().positive("Task number must be positive"),
});

export const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Title must be at least 2 characters long")
      .max(100, "Title cannot exceed 100 characters")
      .optional(),
    description: z.string().trim().max(500, "Description cannot exceed 500 characters").optional().nullable(),
    priority: z.enum(TaskPriority).optional(),
    status: z.enum(TaskStatus).optional(),
    assigneeId: z.cuid().optional().nullable(),
    dueDate: z.iso.datetime().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, "At least one field must be provided");

export type ProjectParamsDto = z.infer<typeof projectParamsSchema>;
export type CreateTaskDto = z.infer<typeof createTaskSchema>;
export type TaskQueryDto = z.infer<typeof taskQuerySchema>;
export type TaskParamsDto = z.infer<typeof taskParamsSchema>;
export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;
