import { prisma } from "../../config/prisma.ts";
import type { Prisma } from "../../prisma/generated/prisma/client.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { ProjectMembersQueryDto } from "./schemas/project-members.schema.ts";
import type { ProjectMember } from "./types/project-members.types.ts";

export async function findAll({
  projectId,
  query,
}: {
  projectId: string;
  query: ProjectMembersQueryDto;
}): Promise<PaginatedResult<ProjectMember>> {
  const where: Prisma.ProjectMemberWhereInput = {};

  where.projectId = projectId;
  where.isActive = query.isActive ?? true; // Por defecto solo los que esten activos

  if (query.role) {
    where.role = query.role;
  }

  // Construimos la ordenacion
  const orderBy: Prisma.ProjectMemberOrderByWithRelationInput = {
    [query.sort]: query.order,
  };

  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.projectMember.findMany({
      where,
      orderBy,
      skip,
      take: query.limit,
    }),

    prisma.projectMember.count({
      where,
    }),
  ]);

  return {
    items,
    total,
  };
}
