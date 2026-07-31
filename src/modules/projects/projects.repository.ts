import { prisma } from "../../config/prisma.ts";
import type { CreateProjectDto, ProjectsQueryDto, UpdateProjectDto } from "./schemas/projects.schema.ts";
import type { Project, Workspace, WorkspaceMember, ProjectMember } from "./types/projects.types.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { Prisma } from "../../prisma/generated/prisma/client.ts";

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
        icon: data.icon,
        color: data.color,
      },
    });

    // Si va todo bien se crea el miembro del proyecto
    await tx.projectMember.create({
      data: {
        projectId: project.id,
        userId,
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
  query: ProjectsQueryDto;
  userId: string;
  workspaceId: string;
}): Promise<PaginatedResult<Project>> {
  // Construimos los filtros
  const where: Prisma.ProjectWhereInput = {};

  // Proyectos de un workspace de los cuales es miembro
  where.workspaceId = workspaceId;
  where.members = {
    some: {
      userId: userId,
    },
  };

  // Luego los filtros de la paginacion
  where.isArchived = query.isArchived ?? false; // Por defecto solo los que no esten archivadoss

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

export async function findBySlug({
  workspaceId,
  slug,
}: {
  workspaceId: string;
  slug: string;
}): Promise<Project | null> {
  return prisma.project.findUnique({
    where: {
      workspaceId_slug: {
        workspaceId,
        slug,
      },
    },
  });
}

export async function update({
  data,
  projectId,
}: {
  data: UpdateProjectDto & { slug: string };
  projectId: string;
}): Promise<Project> {
  return await prisma.project.update({
    where: {
      id: projectId,
    },
    data: {
      name: data.name,
      description: data.description,
      icon: data.icon,
      color: data.color,
      slug: data.slug,
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

export async function findProjectMember({
  userId,
  projectId,
}: {
  userId: string;
  projectId: string;
}): Promise<ProjectMember | null> {
  return prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        userId,
        projectId,
      },
    },
  });
}
