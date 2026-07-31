import { prisma } from "../../config/prisma.ts";
import type { CreateProjectDto } from "./schemas/projects.schema.ts";
import type { Project, Workspace, WorkspaceMember } from "./types/projects.types.ts";

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
