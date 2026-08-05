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
