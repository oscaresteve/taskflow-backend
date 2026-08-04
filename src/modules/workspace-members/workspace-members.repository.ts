import { prisma } from "../../config/prisma.ts";
import type { Prisma } from "../../prisma/generated/prisma/client.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { CreateWorkspaceMemberDto, WorkspaceMembersQueryDto } from "./schemas/workspace-members.schema.ts";
import type { Workspace, WorkspaceMember } from "./types/workspace-members.types.ts";
import { WorkspaceMemberStatus, WorkspaceRole } from "./types/workspace-members.types.ts";

export async function findWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  return prisma.workspace.findUnique({
    where: {
      slug,
      isActive: true,
    },
  });
}

export async function findWorkspaceMember({
  userId,
  workspaceId,
}: {
  userId: string;
  workspaceId: string;
}): Promise<WorkspaceMember | null> {
  return prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
  });
}

export async function findAll({
  workspaceId,
  query,
}: {
  workspaceId: string;
  query: WorkspaceMembersQueryDto;
}): Promise<PaginatedResult<WorkspaceMember>> {
  const where: Prisma.WorkspaceMemberWhereInput = {};

  where.workspaceId = workspaceId;
  where.status = query.status ?? WorkspaceMemberStatus.ACTIVE; // Por defecto solo los que esten activos

  if (query.role) {
    where.role = query.role;
  }

  // Construimos la ordenacion
  const orderBy: Prisma.WorkspaceMemberOrderByWithRelationInput = {
    [query.sort]: query.order,
  };

  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.workspaceMember.findMany({
      where,
      orderBy,
      skip,
      take: query.limit,
    }),

    prisma.workspaceMember.count({
      where,
    }),
  ]);

  return {
    items,
    total,
  };
}

export async function findUserActive(id: string): Promise<{ id: string; isActive: boolean } | null> {
  return prisma.user.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      isActive: true,
    },
  });
}

export async function create({
  data,
  workspaceId,
}: {
  data: CreateWorkspaceMemberDto;
  workspaceId: string;
}): Promise<WorkspaceMember> {
  return await prisma.workspaceMember.create({
    data: {
      userId: data.userId,
      role: data.role,
      workspaceId,
    },
  });
}

export async function activate({ workspaceId, userId }: { workspaceId: string; userId: string }): Promise<void> {
  await prisma.workspaceMember.update({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
    data: {
      status: WorkspaceMemberStatus.ACTIVE,
      joinedAt: new Date(),
    },
  });
}

export async function update({
  workspaceId,
  userId,
  role,
}: {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}): Promise<void> {
  await prisma.workspaceMember.update({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
    data: {
      role,
    },
  });
}
