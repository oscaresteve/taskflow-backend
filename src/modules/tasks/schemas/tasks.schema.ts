import z from "zod";
import { TaskPriority, TaskStatus } from "../../../shared/types/prisma.types.ts";
import {
  booleanQueryParamSchema,
  descriptionSchema,
  limitSchema,
  pageSchema,
  searchSchema,
  sortOrderSchema,
} from "../../../shared/schemas/common.schema.ts";

export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Title must be at least 2 characters long")
    .max(100, "Title cannot exceed 100 characters"),
  description: descriptionSchema,
  priority: z.enum(TaskPriority),
  assigneeId: z.cuid().optional(),
  dueDate: z.iso.datetime().optional(),
});

const sortableFields = ["position", "title", "status", "priority", "dueDate", "createdAt", "updatedAt"] as const;

export const taskQuerySchema = z.object({
  // Pagination
  page: pageSchema,
  limit: limitSchema,

  // Filters
  isArchived: booleanQueryParamSchema,

  search: searchSchema,

  status: z.enum(TaskStatus).optional(),

  priority: z.enum(TaskPriority).optional(),

  assigneeId: z.cuid().optional(),

  // Sorting
  sort: z.enum(sortableFields).default("position"),
  order: sortOrderSchema,
});

export const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Title must be at least 2 characters long")
      .max(100, "Title cannot exceed 100 characters")
      .optional(),
    description: descriptionSchema.nullable(),
    priority: z.enum(TaskPriority).optional(),
    status: z.enum(TaskStatus).optional(),
    assigneeId: z.cuid().optional().nullable(),
    dueDate: z.iso.datetime().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, "At least one field must be provided");

export type CreateTaskDto = z.infer<typeof createTaskSchema>;
export type TaskQueryDto = z.infer<typeof taskQuerySchema>;
export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;
