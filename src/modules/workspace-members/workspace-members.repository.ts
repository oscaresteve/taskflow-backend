import { prisma } from "../../config/prisma.ts";
import type { Prisma } from "../../prisma/generated/prisma/client.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { CreateWorkspaceMemberDto, WorkspaceMembersQueryDto } from "./schemas/workspace-members.schema.ts";
import { WorkspaceMemberStatus, WorkspaceRole, type User, type WorkspaceMember } from "../../shared/types/prisma.types.ts";

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
}): Promise<PaginatedResult<WorkspaceMember & { user: User }>> {
  const where: Prisma.WorkspaceMemberWhereInput = {};

  where.workspaceId = workspaceId;

  // Por defecto solo los que esten activos
  if (!query.status) {
    where.status = WorkspaceMemberStatus.ACTIVE;
  } else if (Array.isArray(query.status)) {
    where.status = { in: query.status };
  } else {
    where.status = query.status;
  }

  if (query.role) {
    where.role = query.role;
  }

  const userWhere: Prisma.UserWhereInput = {};

  if (query.excludeProjectSlug) {
    userWhere.projectMembers = {
      none: {
        project: { slug: query.excludeProjectSlug },
      },
    };
  }

  if (query.search) {
    userWhere.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
    ];
  }

  if (Object.keys(userWhere).length > 0) {
    where.user = userWhere;
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
      include: {
        user: true,
      },
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

export async function remove({ workspaceId, userId }: { workspaceId: string; userId: string }): Promise<void> {
  await prisma.workspaceMember.update({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
    data: {
      status: WorkspaceMemberStatus.REMOVED,
      role: WorkspaceRole.MEMBER, // Eliminar permisos por si en un futuro se vuelve a activar el usuario
      joinedAt: null,
    },
  });
}
