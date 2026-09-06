import { prisma } from "../../config/prisma.ts";
import type { Prisma } from "../../prisma/generated/prisma/client.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { CreateTaskDto, TaskQueryDto, UpdateTaskDto } from "./schemas/tasks.schema.ts";
import type { Task, TaskStatus } from "../../shared/types/prisma.types.ts";
import { rankBetween } from "../../shared/utils/lexorank.ts";

// Rank para una tarea nueva: al final de su columna.
export async function getNextTaskRank({
  projectId,
  status,
}: {
  projectId: string;
  status: TaskStatus;
}): Promise<string> {
  const last = await prisma.task.findFirst({
    where: {
      projectId,
      status,
      isArchived: false,
    },
    select: {
      rank: true,
    },
    orderBy: {
      rank: "desc",
    },
  });

  return rankBetween(last?.rank ?? null, null);
}

export async function findAllForBoard(projectId: string): Promise<Task[]> {
  return prisma.task.findMany({
    where: {
      projectId,
      isArchived: false,
    },
    orderBy: [{ rank: "asc" }, { taskNumber: "asc" }],
  });
}

export async function create({
  data,
  projectId,
  userId,
  rank,
}: {
  data: CreateTaskDto;
  projectId: string;
  userId: string;
  rank: string;
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
        rank,
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

  if (query.status) {
    where.status = query.status;
  }

  if (query.priority) {
    where.priority = query.priority;
  }

  if (query.assigneeId) {
    where.assigneeId = query.assigneeId;
  }

  // Construimos la ordenacion. El taskNumber desempata: dos tareas pueden compartir rank
  // (transitoriamente tras movimientos concurrentes) y sin desempate Postgres no garantiza un
  // orden estable, con lo que las tarjetas podrian intercambiarse solas entre peticiones.
  const orderBy: Prisma.TaskOrderByWithRelationInput[] = [{ [query.sort]: query.order }, { taskNumber: "asc" }];

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

export async function findById(id: string): Promise<Task | null> {
  return prisma.task.findUnique({
    where: {
      id,
    },
  });
}

// Rank que le corresponde a la tarea justo detras del ancla (o al principio de la columna si no hay
// ancla). Devuelve null si el ancla ya no es una tarea viva de la columna destino.
async function resolveRank(
  tx: Prisma.TransactionClient,
  {
    projectId,
    status,
    taskId,
    afterTaskId,
  }: {
    projectId: string;
    status: TaskStatus;
    taskId: string;
    afterTaskId: string | null;
  },
): Promise<string | null> {
  let previous: string | null = null;

  if (afterTaskId) {
    // El ancla se lee ya bajo el lock: entre que el service la valido y abrimos la transaccion,
    // otro movimiento pudo cambiar su rank.
    const anchor = await tx.task.findFirst({
      where: {
        id: afterTaskId,
        projectId,
        status,
        isArchived: false,
      },
      select: {
        rank: true,
      },
    });

    if (!anchor) return null;

    previous = anchor.rank;
  }

  // Vecina de abajo: la primera de la columna si vamos al principio, o la siguiente al ancla. La
  // propia tarea movida se excluye, que en un movimiento dentro de la columna sigue estando enmedio.
  const next = await tx.task.findFirst({
    where: {
      projectId,
      status,
      isArchived: false,
      id: { not: taskId },
      ...(previous === null ? {} : { rank: { gt: previous } }),
    },
    orderBy: {
      rank: "asc",
    },
    select: {
      rank: true,
    },
  });

  return rankBetween(previous, next?.rank ?? null);
}

// Mueve la tarea a la columna destino, justo detras del ancla. Escribe UNA sola fila: el rank nuevo
// va entre el de sus dos vecinas, sin tocar a ninguna otra tarea.
// Devuelve null si el ancla dejo de ser valida entre la validacion del service y la transaccion.
export async function move({
  projectId,
  task,
  status,
  afterTaskId,
  completedAt,
}: {
  projectId: string;
  task: Task;
  status: TaskStatus;
  afterTaskId: string | null;
  completedAt: Date | null;
}): Promise<Task | null> {
  return prisma.$transaction(async (tx) => {
    // Serializa los movimientos que aterrizan en la misma columna. Sin esto, dos usuarios que
    // sueltan sobre el mismo hueco leen las mismas vecinas, generan el mismo rank y ambos se lo
    // asignan: las dos tarjetas acaban empatadas y su orden lo decide el desempate por taskNumber
    // en vez del usuario. El lock se libera solo al cerrar la transaccion.
    // Solo se bloquea la columna destino: en el origen no se reescribe nada.
    // $executeRaw y no $queryRaw: la funcion devuelve void y Prisma no sabe deserializar esa columna.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${projectId}:${status}`}, 0))`;

    const rank = await resolveRank(tx, { projectId, status, taskId: task.id, afterTaskId });

    if (rank === null) return null;

    return tx.task.update({
      where: {
        id: task.id,
      },
      data: {
        status,
        rank,
        completedAt,
      },
    });
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
