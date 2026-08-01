import { prisma } from "../../config/prisma.ts";
import type { CreateTaskDto } from "./schemas/tasks.schema.ts";
import type { Project, ProjectMember, Task, Workspace, WorkspaceMember } from "./types/tasks.types.ts";

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

export async function getNextTaskPosition(projectId: string): Promise<number> {
  const lastPosition = await prisma.task.findFirst({
    where: {
      projectId,
    },
    select: {
      position: true,
    },
    orderBy: {
      position: "desc",
    },
  });
  return lastPosition ? lastPosition.position + 1 : 1;
}

export async function create({
  data,
  projectId,
  userId,
  position,
}: {
  data: CreateTaskDto;
  projectId: string;
  userId: string;
  position: number;
}): Promise<Task> {
  return prisma.$transaction(async (tx) => {
    // Obtener el taskNumber y luego incrementarlo en el proyecto
    const project = await tx.project.findUnique({
      where: {
        id: projectId,
      },
      select: {
        nextTaskNumber: true,
      },
    });

    const taskNumber = project!.nextTaskNumber;

    const task = await tx.task.create({
      data: {
        title: data.title,
        priority: data.priority,
        assigneeId: data.assigneeId,
        dueDate: data.dueDate,
        description: data.description,
        projectId,
        createdById: userId,
        taskNumber,
        position,
      },
    });

    await tx.project.update({
      where: {
        id: task.projectId,
      },
      data: {
        nextTaskNumber: { increment: 1 },
      },
    });

    return task;
  });
}
