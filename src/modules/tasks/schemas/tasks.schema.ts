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
  status: z.enum(TaskStatus).optional(),
  assigneeId: z.cuid().optional(),
  dueDate: z.iso.datetime().optional(),
});

const sortableFields = ["rank", "title", "status", "priority", "dueDate", "createdAt", "updatedAt"] as const;
export const dueDateFilterValues = ["OVERDUE", "THIS_WEEK", "NONE"] as const;

export const taskQuerySchema = z.object({
  // Pagination
  page: pageSchema,
  limit: limitSchema,

  // Filters
  isArchived: booleanQueryParamSchema,
  isFavorite: booleanQueryParamSchema,

  search: searchSchema,

  // "OPEN" es un sentinel, igual que el "UNASSIGNED" de assigneeId: pide todo lo que no esta
  // DONE, que es a donde enlaza el contador de tareas abiertas de los overviews.
  status: z.union([z.enum(TaskStatus), z.literal("OPEN")]).optional(),

  priority: z.enum(TaskPriority).optional(),

  // "UNASSIGNED" es el sentinel que ya usa el filtro de responsable del Kanban en el frontend
  // para pedir las tareas sin asignar; un cuid real filtra por ese responsable concreto.
  assigneeId: z.union([z.cuid(), z.literal("UNASSIGNED")]).optional(),

  dueDate: z.enum(dueDateFilterValues).optional(),

  // Sorting
  sort: z.enum(sortableFields).default("rank"),
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

export const moveTaskSchema = z.object({
  status: z.enum(TaskStatus),
  afterTaskId: z.cuid().nullable(),
});

export type CreateTaskDto = z.infer<typeof createTaskSchema>;
export type TaskQueryDto = z.infer<typeof taskQuerySchema>;
export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;
export type MoveTaskDto = z.infer<typeof moveTaskSchema>;
