import { prisma } from "../../config/prisma.ts";
import type { Prisma } from "../../prisma/generated/prisma/client.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type {
  CreateProjectMemberDto,
  ProjectMembersQueryDto,
  UpdateProjectMemberDto,
} from "./schemas/project-members.schema.ts";
import type { ProjectMember, User } from "../../shared/types/prisma.types.ts";

export async function findAll({
  projectId,
  query,
}: {
  projectId: string;
  query: ProjectMembersQueryDto;
}): Promise<PaginatedResult<ProjectMember & { user: User }>> {
  const where: Prisma.ProjectMemberWhereInput = {};

  where.projectId = projectId;

  // Por defecto solo los que esten activos
  if (query.isActive === undefined) {
    where.isActive = true;
  } else if (Array.isArray(query.isActive)) {
    // Boolean no soporta "in": si vienen ambos valores no filtramos (se devuelven todos).
    const uniqueValues = [...new Set(query.isActive)];
    if (uniqueValues.length === 1) {
      where.isActive = uniqueValues[0];
    }
  } else {
    where.isActive = query.isActive;
  }

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
      include: {
        user: true,
      },
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

export async function findProjectMember({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}): Promise<ProjectMember | null> {
  return await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        userId,
        projectId,
      },
    },
  });
}

export async function create({
  data,
  projectId,
}: {
  data: CreateProjectMemberDto;
  projectId: string;
}): Promise<ProjectMember> {
  return await prisma.projectMember.create({
    data: {
      userId: data.userId,
      role: data.role,
      projectId,
      joinedAt: new Date(),
    },
  });
}

export async function update({
  data,
  projectId,
  userId,
}: {
  data: UpdateProjectMemberDto;
  projectId: string;
  userId: string;
}): Promise<ProjectMember> {
  return await prisma.projectMember.update({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
    data: {
      role: data.role,
    },
  });
}

export async function deactivate({ projectId, userId }: { projectId: string; userId: string }): Promise<void> {
  await prisma.projectMember.update({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
    data: {
      role: "MEMBER",
      isActive: false,
      joinedAt: null,
    },
  });
}
