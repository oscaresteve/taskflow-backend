import z from "zod";
import { ProjectRole } from "../../../shared/types/prisma.types.ts";
import {
  booleanQueryParamSchema,
  limitSchema,
  pageSchema,
  sortOrderSchema,
} from "../../../shared/schemas/common.schema.ts";

const sortableFields = ["joinedAt", "createdAt", "updatedAt"] as const;

export const projectMembersQuerySchema = z.object({
  // Pagination
  page: pageSchema,
  limit: limitSchema,

  // Filters
  isActive: booleanQueryParamSchema,

  role: z.enum(ProjectRole).optional(),

  // Sorting
  sort: z.enum(sortableFields).default("createdAt"),
  order: sortOrderSchema,
});

export const createProjectMemberSchema = z.object({
  userId: z.cuid(),

  role: z.enum(ProjectRole).default("MEMBER"),
});

export const updateProjectMemberSchema = z.object({
  role: z.enum(ProjectRole),
});

export type ProjectMembersQueryDto = z.infer<typeof projectMembersQuerySchema>;
export type CreateProjectMemberDto = z.infer<typeof createProjectMemberSchema>;
export type UpdateProjectMemberDto = z.infer<typeof updateProjectMemberSchema>;
