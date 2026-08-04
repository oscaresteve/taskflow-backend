import z from "zod";
import { WorkspaceMemberStatus, WorkspaceRole } from "../types/workspace-members.types.ts";

export const workspaceParamsSchema = z.object({
  workspaceSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug format is invalid"),
});

const sortableFields = ["joinedAt", "createdAt", "updatedAt"] as const;

export const workspaceMembersQuerySchema = z.object({
  // Pagination
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),

  // Filters
  role: z.enum(WorkspaceRole).optional(),
  status: z.enum(WorkspaceMemberStatus).optional(),

  // Sorting
  sort: z.enum(sortableFields).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("asc"),
});

export const createWorkspaceMemberSchema = z.object({
  userId: z.cuid(),

  role: z.enum(WorkspaceRole).default("MEMBER"),
});

export type WorkspaceParamsDto = z.infer<typeof workspaceParamsSchema>;
export type WorkspaceMembersQueryDto = z.infer<typeof workspaceMembersQuerySchema>;
export type CreateWorkspaceMemberDto = z.infer<typeof createWorkspaceMemberSchema>;
