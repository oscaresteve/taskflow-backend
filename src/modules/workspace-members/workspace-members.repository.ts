import { prisma } from "../../config/prisma.ts";
import * as activityRepository from "../activity/activity.repository.ts";
import type { ActivityEventInput } from "../activity/types/activity.types.ts";
import type { Prisma } from "../../prisma/generated/prisma/client.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type {
  CreateWorkspaceMemberDto,
  WorkspaceMembersAllQueryDto,
  WorkspaceMembersQueryDto,
} from "./schemas/workspace-members.schema.ts";
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

function buildWhere(workspaceId: string, query: WorkspaceMembersAllQueryDto): Prisma.WorkspaceMemberWhereInput {
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
        // El slug solo es unico por workspace, asi que sin acotarlo tambien excluiria a los
        // miembros de un proyecto homonimo de otro espacio.
        project: { workspaceId, slug: query.excludeProjectSlug },
      },
    };
  }

  if (query.search) {
    userWhere.OR = [
      { firstName: { contains: query.search, mode: "insensitive" } },
      { lastName: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
    ];
  }

  if (Object.keys(userWhere).length > 0) {
    where.user = userWhere;
  }

  return where;
}

export async function findAll({
  workspaceId,
  query,
}: {
  workspaceId: string;
  query: WorkspaceMembersQueryDto;
}): Promise<PaginatedResult<WorkspaceMember & { user: User }>> {
  const where = buildWhere(workspaceId, query);

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

// Misma logica que findAll pero sin paginar, para listas acotadas (miembros de un workspace)
// donde forzar al cliente a encadenar paginas solo añade complejidad sin proteger de nada.
export async function findAllUnpaginated({
  workspaceId,
  query,
}: {
  workspaceId: string;
  query: WorkspaceMembersAllQueryDto;
}): Promise<(WorkspaceMember & { user: User })[]> {
  const where = buildWhere(workspaceId, query);

  const orderBy: Prisma.WorkspaceMemberOrderByWithRelationInput = {
    [query.sort]: query.order,
  };

  return prisma.workspaceMember.findMany({
    where,
    orderBy,
    include: {
      user: true,
    },
  });
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
  events,
}: {
  data: CreateWorkspaceMemberDto;
  workspaceId: string;
  events: ActivityEventInput[];
}): Promise<WorkspaceMember> {
  return prisma.$transaction(async (tx) => {
    const workspaceMember = await tx.workspaceMember.create({
      data: {
        userId: data.userId,
        role: data.role,
        workspaceId,
      },
    });

    await activityRepository.record(tx, events);

    return workspaceMember;
  });
}

export async function activate({
  workspaceId,
  userId,
  events,
}: {
  workspaceId: string;
  userId: string;
  events: ActivityEventInput[];
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.workspaceMember.update({
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

    await activityRepository.record(tx, events);
  });
}

export async function update({
  workspaceId,
  userId,
  role,
  events,
}: {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  events: ActivityEventInput[];
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.workspaceMember.update({
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

    await activityRepository.record(tx, events);
  });
}

export async function remove({
  workspaceId,
  userId,
  events,
}: {
  workspaceId: string;
  userId: string;
  events: ActivityEventInput[];
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.workspaceMember.update({
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

    await activityRepository.record(tx, events);
  });
}
