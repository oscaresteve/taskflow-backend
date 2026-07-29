import { prisma } from "../../config/prisma.ts";
import type { Prisma } from "../../prisma/generated/prisma/client.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { CreateWorkspaceDto, WorkspacesQueryDto } from "./schemas/workspaces.schema.ts";
import {
  WorkspaceMemberStatus,
  WorkspaceRole,
  type Workspace,
  type WorkspaceMember,
} from "./types/workspaces.types.ts";

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

export async function findAllByUserId(query: WorkspacesQueryDto, userId: string): Promise<PaginatedResult<Workspace>> {
  // Construimos los filtros
  const where: Prisma.WorkspaceWhereInput = {};

  // Añadimos primero el filtro por usuario
  where.members = {
    some: {
      userId: userId,
    },
  };

  // Luego los filtros de la paginacion
  if (query.isActive !== undefined) {
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

export async function findBySlug(slug: string): Promise<Workspace | null> {
  return prisma.workspace.findUnique({
    where: {
      slug,
    },
  });
}

export async function findWorkspaceMember(userId: string, workspaceId: string): Promise<WorkspaceMember | null> {
  return prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
  });
}
