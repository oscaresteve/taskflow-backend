import z from "zod";
import { WorkspaceMemberStatus, WorkspaceRole } from "../../../shared/types/prisma.types.ts";
import {
  limitSchema,
  pageSchema,
  searchSchema,
  slugSchema,
  sortOrderSchema,
} from "../../../shared/schemas/common.schema.ts";

const sortableFields = ["joinedAt", "createdAt", "updatedAt"] as const;

export const workspaceMembersQuerySchema = z.object({
  // Pagination
  page: pageSchema,
  limit: limitSchema,

  // Filters
  role: z.enum(WorkspaceRole).optional(),
  // Acepta un status ("?status=PENDING") o varios ("?status=ACTIVE&status=PENDING").
  status: z.union([z.enum(WorkspaceMemberStatus), z.array(z.enum(WorkspaceMemberStatus))]).optional(),

  // Busca por nombre o email del usuario miembro.
  search: searchSchema,

  // Excluye a quien ya tenga una fila de membresia (cualquier isActive) en ese proyecto del
  // workspace, p.ej. para elegir candidatos al añadir miembros a un proyecto.
  excludeProjectSlug: slugSchema.optional(),

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
