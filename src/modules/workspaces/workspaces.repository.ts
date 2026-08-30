import { prisma } from "../../config/prisma.ts";
import type { Prisma } from "../../prisma/generated/prisma/client.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { CreateWorkspaceDto, UpdateWorkspaceDto, WorkspaceQueryDto } from "./schemas/workspaces.schema.ts";
import {
  WorkspaceMemberStatus,
  WorkspaceRole,
  type Project,
  type User,
  type Workspace,
  type WorkspaceMember,
} from "../../shared/types/prisma.types.ts";

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
        logoUrl: data.logoUrl,
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
        },
      },
      {
        description: {
          contains: query.search,
        },
      },
    ];
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
}: {
  workspaceId: string;
  data: UpdateWorkspaceDto & { slug: string };
}): Promise<Workspace> {
  return prisma.workspace.update({
    where: {
      id: workspaceId,
    },
    data,
  });
}

export async function findProjectsByWorkspaceId(workspaceId: string): Promise<Project[]> {
  return prisma.project.findMany({
    where: {
      workspaceId,
      isArchived: false,
    },
  });
}

export async function findActiveMembersByWorkspaceId(
  workspaceId: string,
): Promise<(WorkspaceMember & { user: User })[]> {
  return prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      status: WorkspaceMemberStatus.ACTIVE,
    },
    include: {
      user: true,
    },
  });
}

export async function deactivate(workspaceId: string): Promise<void> {
  await prisma.workspace.update({
    where: {
      id: workspaceId,
    },
    data: {
      isActive: false,
    },
  });
}
