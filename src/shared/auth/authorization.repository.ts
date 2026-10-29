import { prisma } from "../../config/prisma.ts";
import type { Project, ProjectMember, Task, Workspace, WorkspaceMember, Comment } from "../types/prisma.types.ts";

export async function findWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  return prisma.workspace.findUnique({
    where: {
      slug,
      isActive: true,
    },
  });
}

// Hermana de findWorkspaceBySlug que no mira isActive. Solo la usa el cargador de la reactivacion:
// el borrado logico de un espacio lo hace inalcanzable por slug, asi que sin esto no habria por
// donde devolverlo a la vida.
export async function findWorkspaceBySlugIncludingInactive(slug: string): Promise<Workspace | null> {
  return prisma.workspace.findUnique({
    where: {
      slug,
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

export async function findProjectBySlug({
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
      isArchived: false,
    },
  });
}

// Hermana de findProjectBySlug que no mira isArchived, por el mismo motivo que la de workspace.
export async function findProjectBySlugIncludingArchived({
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

export async function findTaskByNumber({
  projectId,
  taskNumber,
}: {
  projectId: string;
  taskNumber: number;
}): Promise<Task | null> {
  return prisma.task.findUnique({
    where: {
      projectId_taskNumber: {
        projectId,
        taskNumber,
      },
    },
  });
}

export async function findComment(commentId: string): Promise<Comment | null> {
  return prisma.comment.findUnique({
    where: {
      id: commentId,
    },
  });
}

// Los ids que de verdad son miembros activos del proyecto, de entre los que se le pasen. Sirve para
// no fiarse de las menciones que llegan en el cuerpo de un comentario.
export async function findActiveProjectMemberIds({
  projectId,
  userIds,
}: {
  projectId: string;
  userIds: string[];
}): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();

  const members = await prisma.projectMember.findMany({
    where: {
      projectId,
      userId: { in: userIds },
      isActive: true,
    },
    select: {
      userId: true,
    },
  });

  return new Set(members.map((member) => member.userId));
}
