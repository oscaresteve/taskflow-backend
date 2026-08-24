import z from "zod";
import { ProjectRole } from "../../../shared/types/prisma.types.ts";
import { limitSchema, pageSchema, sortOrderSchema } from "../../../shared/schemas/common.schema.ts";

const sortableFields = ["joinedAt", "createdAt", "updatedAt"] as const;

const isActiveQueryParamSchema = z.enum(["true", "false"]).transform((value) => value === "true");

export const projectMembersQuerySchema = z.object({
  // Pagination
  page: pageSchema,
  limit: limitSchema,

  // Filters
  // Acepta un isActive ("?isActive=true") o varios ("?isActive=true&isActive=false").
  isActive: z.union([isActiveQueryParamSchema, z.array(isActiveQueryParamSchema)]).optional(),

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
