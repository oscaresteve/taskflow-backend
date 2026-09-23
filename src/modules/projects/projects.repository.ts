import { prisma } from "../../config/prisma.ts";
import type { CreateProjectDto, ProjectQueryDto, UpdateProjectDto } from "./schemas/projects.schema.ts";
import type { Project } from "../../shared/types/prisma.types.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { Prisma } from "../../prisma/generated/prisma/client.ts";

export async function existsBySlugInWorkspace({
  slug,
  workspaceId,
}: {
  slug: string;
  workspaceId: string;
}): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: {
      workspaceId_slug: {
        workspaceId,
        slug,
      },
    },
    select: {
      id: true,
    },
  });

  return !!project;
}

export async function existsByKeyInWorkspace({
  key,
  workspaceId,
}: {
  key: string;
  workspaceId: string;
}): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: {
      workspaceId_key: {
        workspaceId,
        key,
      },
    },
    select: {
      id: true,
    },
  });

  return !!project;
}

export async function create({
  data,
  slug,
  workspaceId,
  userId,
}: {
  data: CreateProjectDto;
  slug: string;
  workspaceId: string;
  userId: string;
}): Promise<Project> {
  return prisma.$transaction(async (tx) => {
    // Crear el proyecto
    const project = await tx.project.create({
      data: {
        workspaceId,
        name: data.name,
        slug,
        key: data.key,
        description: data.description,
        color: data.color,
      },
    });

    // Si va todo bien se crea el miembro del proyecto
    await tx.projectMember.create({
      data: {
        projectId: project.id,
        userId,
        role: "OWNER",
        joinedAt: new Date(),
      },
    });

    return project;
  });
}

export async function findAll({
  query,
  userId,
  workspaceId,
}: {
  query: ProjectQueryDto;
  userId: string;
  workspaceId: string;
}): Promise<PaginatedResult<Project>> {
  // Construimos los filtros
  const where: Prisma.ProjectWhereInput = {};

  // Proyectos de un workspace de los cuales es miembro activo
  where.workspaceId = workspaceId;
  where.members = {
    some: {
      userId: userId,
      isActive: true,
    },
  };

  // Luego los filtros de la paginacion
  where.isArchived = query.isArchived ?? false; // Por defecto solo los que no esten archivadoss

  if (query.isFavorite === true) {
    where.favorites = { some: { userId } };
  } else if (query.isFavorite === false) {
    where.favorites = { none: { userId } };
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

  // Construimos la ordenacion
  const orderBy: Prisma.ProjectOrderByWithRelationInput = {
    [query.sort]: query.order,
  };

  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy,
      skip,
      take: query.limit,
    }),

    prisma.project.count({
      where,
    }),
  ]);

  return {
    items,
    total,
  };
}

export async function update({
  data,
  projectId,
  newSlug,
}: {
  data: UpdateProjectDto;
  projectId: string;
  newSlug: string;
}): Promise<Project> {
  return await prisma.project.update({
    where: {
      id: projectId,
    },
    data: {
      name: data.name,
      description: data.description,
      color: data.color,
      slug: newSlug,
    },
  });
}

export async function archive(projectId: string): Promise<void> {
  await prisma.project.update({
    where: {
      id: projectId,
    },
    data: {
      isArchived: true,
    },
  });
}

export async function isFavorited({ userId, projectId }: { userId: string; projectId: string }): Promise<boolean> {
  const favorite = await prisma.projectFavorite.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId,
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
  projectIds,
}: {
  userId: string;
  projectIds: string[];
}): Promise<Set<string>> {
  const favorites = await prisma.projectFavorite.findMany({
    where: {
      userId,
      projectId: { in: projectIds },
    },
    select: {
      projectId: true,
    },
  });

  return new Set(favorites.map((favorite) => favorite.projectId));
}

export async function createFavorite({ userId, projectId }: { userId: string; projectId: string }): Promise<void> {
  await prisma.projectFavorite.create({
    data: {
      userId,
      projectId,
    },
  });
}

export async function deleteFavorite({ userId, projectId }: { userId: string; projectId: string }): Promise<void> {
  await prisma.projectFavorite.delete({
    where: {
      userId_projectId: {
        userId,
        projectId,
      },
    },
  });
}
