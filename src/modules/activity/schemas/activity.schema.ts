import z from "zod";
import { ProjectRole, TaskPriority, TaskStatus } from "../../../shared/types/prisma.types.ts";
import { limitSchema, pageSchema } from "../../../shared/schemas/common.schema.ts";

// El feed siempre va de lo mas reciente a lo mas antiguo, asi que no acepta orden ni campo de
// ordenacion: un historial ordenado de otra forma no es un historial.
export const activityQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
});

export type ActivityQueryDto = z.infer<typeof activityQuerySchema>;

const taskRefSchema = z.object({
  taskNumber: z.number().int().positive(),
  taskTitle: z.string(),
});

const memberRefSchema = z.object({
  targetUserId: z.cuid(),
});

export const taskEditedFields = ["title", "description"] as const;

// payload es una columna Json, asi que al leer no hay garantia de tipo: cada accion declara su
// forma y el mapper la parsea antes de dejarla salir en el DTO.
export const activityPayloadSchemas = {
  TASK_CREATED: taskRefSchema,
  TASK_EDITED: taskRefSchema.extend({ fields: z.array(z.enum(taskEditedFields)).min(1) }),
  TASK_STATUS_CHANGED: taskRefSchema.extend({ from: z.enum(TaskStatus), to: z.enum(TaskStatus) }),
  TASK_PRIORITY_CHANGED: taskRefSchema.extend({ from: z.enum(TaskPriority), to: z.enum(TaskPriority) }),
  TASK_ASSIGNEE_CHANGED: taskRefSchema.extend({ from: z.cuid().nullable(), to: z.cuid().nullable() }),
  TASK_DUE_DATE_CHANGED: taskRefSchema.extend({
    from: z.iso.datetime().nullable(),
    to: z.iso.datetime().nullable(),
  }),
  TASK_ARCHIVED: taskRefSchema,
  COMMENT_CREATED: taskRefSchema.extend({ commentId: z.cuid() }),
  PROJECT_MEMBER_ADDED: memberRefSchema.extend({ role: z.enum(ProjectRole) }),
  PROJECT_MEMBER_ROLE_CHANGED: memberRefSchema.extend({ from: z.enum(ProjectRole), to: z.enum(ProjectRole) }),
  PROJECT_MEMBER_DEACTIVATED: memberRefSchema,
} as const;
