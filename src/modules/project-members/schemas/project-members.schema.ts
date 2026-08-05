import z from "zod";
import { ProjectRole } from "../types/project-members.types.ts";

export const projectParamsSchema = z.object({
  workspaceSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug format is invalid"),
  projectSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug format is invalid"),
});

const sortableFields = ["joinedAt", "createdAt", "updatedAt"] as const;

export const projectMembersQuerySchema = z.object({
  // Pagination
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),

  // Filters
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),

  role: z.enum(ProjectRole).optional(),

  // Sorting
  sort: z.enum(sortableFields).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("asc"),
});

export const createProjectMemberSchema = z.object({
  userId: z.cuid(),

  role: z.enum(ProjectRole).default("MEMBER"),
});

export const projectMemberParamsSchema = z.object({
  workspaceSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug format is invalid"),
  projectSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug format is invalid"),
  userId: z.cuid(),
});

export const updateProjectMemberSchema = z.object({
  role: z.enum(ProjectRole),
});

export type ProjectParamsDto = z.infer<typeof projectParamsSchema>;
export type ProjectMembersQueryDto = z.infer<typeof projectMembersQuerySchema>;
export type CreateProjectMemberDto = z.infer<typeof createProjectMemberSchema>;
export type ProjectMemberParamsDto = z.infer<typeof projectMemberParamsSchema>;
export type UpdateProjectMemberDto = z.infer<typeof updateProjectMemberSchema>;
