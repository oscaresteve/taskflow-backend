import z from "zod";
import { WorkspaceMemberStatus, WorkspaceRole } from "../../../shared/types/prisma.types.ts";
import { limitSchema, pageSchema, sortOrderSchema } from "../../../shared/schemas/common.schema.ts";

const sortableFields = ["joinedAt", "createdAt", "updatedAt"] as const;

export const workspaceMembersQuerySchema = z.object({
  // Pagination
  page: pageSchema,
  limit: limitSchema,

  // Filters
  role: z.enum(WorkspaceRole).optional(),
  status: z.enum(WorkspaceMemberStatus).optional(),

  // Sorting
  sort: z.enum(sortableFields).default("createdAt"),
  order: sortOrderSchema,
});

export const createWorkspaceMemberSchema = z.object({
  userId: z.cuid(),

  role: z.enum(WorkspaceRole).default("MEMBER"),
});

export const updateWorkspaceMemberSchema = z.object({
  role: z.enum(WorkspaceRole),
});

export type WorkspaceMembersQueryDto = z.infer<typeof workspaceMembersQuerySchema>;
export type CreateWorkspaceMemberDto = z.infer<typeof createWorkspaceMemberSchema>;
export type UpdateWorkspaceMemberDto = z.infer<typeof updateWorkspaceMemberSchema>;
