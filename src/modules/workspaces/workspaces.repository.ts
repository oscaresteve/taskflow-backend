import { prisma } from "../../config/prisma.ts";
import * as activityRepository from "../activity/activity.repository.ts";
import type { ActivityEventInput } from "../activity/types/activity.types.ts";
import type { Prisma } from "../../prisma/generated/prisma/client.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { CreateWorkspaceDto, UpdateWorkspaceDto, WorkspaceQueryDto } from "./schemas/workspaces.schema.ts";
import { WorkspaceMemberStatus, WorkspaceRole, type Workspace } from "../../shared/types/prisma.types.ts";

// Solo comunicarse con el ORM o DB

export async function create({
  data,
  slug,
  userId,
}: {
  data: CreateWorkspaceDto;
  slug: string;
  userId: string;
}): Promise<Workspace> {
  // Crear el workspacemeber usando Prisma Interactive Transactions
  return prisma.$transaction(async (tx) => {
    // 1. Crear el workspace
    const workspace = await tx.workspace.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
      },
    });

    // 2. Añadir al creador como OWNER
    await tx.workspaceMember.create({
      data: {
        userId,
        workspaceId: workspace.id,
        role: WorkspaceRole.OWNER,
        status: WorkspaceMemberStatus.ACTIVE,
        joinedAt: new Date(),
      },
    });

    // El id del espacio nace dentro de la transaccion, asi que el evento se arma aqui.
    await activityRepository.record(tx, [
      {
        workspaceId: workspace.id,
        projectId: null,
        taskId: null,
        actorId: userId,
        action: "WORKSPACE_CREATED",
        payload: { workspaceName: workspace.name },
      },
    ]);

    return workspace;
  });
}

export async function existsBySlug(slug: string): Promise<boolean> {
  const workspace = await prisma.workspace.findUnique({
    where: {
      slug,
    },
    select: {
      id: true,
    },
  });

  return !!workspace;
}

export async function findAllByUserId({
  query,
  userId,
}: {
  query: WorkspaceQueryDto;
  userId: string;
}): Promise<PaginatedResult<Workspace>> {
  // Construimos los filtros
  const where: Prisma.WorkspaceWhereInput = {};

  // Añadimos primero el filtro por usuario, solo membresias activas
  where.members = {
    some: {
      userId: userId,
      status: WorkspaceMemberStatus.ACTIVE,
    },
  };

  // Luego los filtros de la paginacion
  // Por defecto solo activos
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

  if (query.search) {
    where.OR = [
      {
        name: {
          contains: query.search,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: query.search,
          mode: "insensitive",
        },
      },
    ];
  }

  if (query.isFavorite === true) {
    where.favorites = { some: { userId } };
  } else if (query.isFavorite === false) {
    where.favorites = { none: { userId } };
  }

  // Construimos la ordenacion
  const orderBy: Prisma.WorkspaceOrderByWithRelationInput = {
    [query.sort]: query.order,
  };

  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.workspace.findMany({
      where,
      orderBy,
      skip,
      take: query.limit,
    }),

    prisma.workspace.count({
      where,
    }),
  ]);

  return {
    items,
    total,
  };
}

export async function findBySlugIncludingInactive(slug: string): Promise<Workspace | null> {
  return prisma.workspace.findUnique({
    where: {
      slug,
    },
  });
}

export async function update({
  workspaceId,
  data,
  events,
}: {
  workspaceId: string;
  data: UpdateWorkspaceDto & { slug: string };
  events: ActivityEventInput[];
}): Promise<Workspace> {
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.update({
      where: {
        id: workspaceId,
      },
      data,
    });

    await activityRepository.record(tx, events);

    return workspace;
  });
}

export async function updateAvatarKey({
  workspaceId,
  avatarKey,
  events,
}: {
  workspaceId: string;
  avatarKey: string | null;
  events: ActivityEventInput[];
}): Promise<Workspace> {
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.update({
      where: {
        id: workspaceId,
      },
      data: {
        avatarKey,
      },
    });

    await activityRepository.record(tx, events);

    return workspace;
  });
}

export async function deactivate({
  workspaceId,
  events,
}: {
  workspaceId: string;
  events: ActivityEventInput[];
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.workspace.update({
      where: {
        id: workspaceId,
      },
      data: {
        isActive: false,
      },
    });

    await activityRepository.record(tx, events);
  });
}

export async function isFavorited({ userId, workspaceId }: { userId: string; workspaceId: string }): Promise<boolean> {
  const favorite = await prisma.workspaceFavorite.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
    select: {
      id: true,
    },
  });

  return !!favorite;
}

export async function findFavoritedIds({
  userId,
  workspaceIds,
}: {
  userId: string;
  workspaceIds: string[];
}): Promise<Set<string>> {
  const favorites = await prisma.workspaceFavorite.findMany({
    where: {
      userId,
      workspaceId: { in: workspaceIds },
    },
    select: {
      workspaceId: true,
    },
  });

  return new Set(favorites.map((favorite) => favorite.workspaceId));
}

export async function createFavorite({ userId, workspaceId }: { userId: string; workspaceId: string }): Promise<void> {
  await prisma.workspaceFavorite.create({
    data: {
      userId,
      workspaceId,
    },
  });
}

export async function deleteFavorite({ userId, workspaceId }: { userId: string; workspaceId: string }): Promise<void> {
  await prisma.workspaceFavorite.delete({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
  });
}
