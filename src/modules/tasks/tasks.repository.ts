import { prisma } from "../../config/prisma.ts";
import type { Prisma } from "../../prisma/generated/prisma/client.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { CreateTaskDto, TaskQueryDto, UpdateTaskDto } from "./schemas/tasks.schema.ts";
import type { Task } from "./types/tasks.types.ts";

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
  query: TaskQueryDto;
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

export async function update({
  data,
  projectId,
  taskNumber,
  completedAt,
}: {
  data: UpdateTaskDto;
  projectId: string;
  taskNumber: number;
  completedAt: Date | null;
}): Promise<Task> {
  return await prisma.task.update({
    where: {
      projectId_taskNumber: {
        projectId,
        taskNumber,
      },
    },
    data: {
      title: data.title,
      description: data.description,
      priority: data.priority,
      status: data.status,
      assigneeId: data.assigneeId,
      dueDate: data.dueDate,
      completedAt,
    },
  });
}

export async function archive({ projectId, taskNumber }: { projectId: string; taskNumber: number }): Promise<void> {
  await prisma.task.update({
    where: {
      projectId_taskNumber: {
        projectId,
        taskNumber,
      },
    },
    data: {
      isArchived: true,
    },
  });
}
