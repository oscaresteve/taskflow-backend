import { prisma } from "../../config/prisma.ts";
import type { Prisma } from "../../prisma/generated/prisma/client.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type {
  CreateProjectMemberDto,
  ProjectMembersQueryDto,
  UpdateProjectMemberDto,
} from "./schemas/project-members.schema.ts";
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
