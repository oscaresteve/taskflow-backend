import { prisma } from "../../config/prisma.ts";
import type { Prisma } from "../../prisma/generated/prisma/client.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { CreateTaskDto, TasksQueryDto } from "./schemas/tasks.schema.ts";
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

export async function findAll({
  projectId,
  query,
}: {
  projectId: string;
  query: TasksQueryDto;
}): Promise<PaginatedResult<Task>> {
  const where: Prisma.TaskWhereInput = {};

  where.projectId = projectId;
  where.isArchived = query.isArchived ?? false; // Por defecto solo los que no esten archivadoss

  if (query.search) {
    where.OR = [
      {
        title: {
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

  if (query.status) {
    where.status = query.status;
  }

  if (query.priority) {
    where.priority = query.priority;
  }

  if (query.assigneeId) {
    where.assigneeId = query.assigneeId;
  }

  // Construimos la ordenacion
  const orderBy: Prisma.TaskOrderByWithRelationInput = {
    [query.sort]: query.order,
  };

  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy,
      skip,
      take: query.limit,
    }),

    prisma.task.count({
      where,
    }),
  ]);

  return {
    items,
    total,
  };
}

export async function findByTaskNumber({
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
