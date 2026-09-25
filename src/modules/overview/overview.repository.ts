import { prisma } from "../../config/prisma.ts";
import { TaskStatus } from "../../shared/types/prisma.types.ts";
import type { Prisma } from "../../prisma/generated/prisma/client.ts";
import type { Task } from "../../shared/types/prisma.types.ts";

// Solo comunicarse con el ORM o DB

const TASK_LIST_LIMIT = 8;
const DUE_SOON_DAYS = 7;
const VELOCITY_DAYS = 7;

// Todo lo que la fila de tarea de los overviews necesita para pintarse sin pedir nada mas:
// la key del proyecto para el identificador (CORE-113) y el responsable para el avatar.
const overviewTaskInclude = {
  project: { select: { key: true, slug: true, name: true, workspace: { select: { slug: true } } } },
  assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
};

export type OverviewTaskRow = Task & {
  isFavorite: boolean;
  project: { key: string; slug: string; name: string; workspace: { slug: string } };
  assignee: { id: string; firstName: string; lastName: string; avatarUrl: string | null } | null;
};

type OverviewTaskRowWithoutFavorite = Omit<OverviewTaskRow, "isFavorite">;

export type DueDateBucketRows = {
  overdue: number;
  dueSoon: number;
  noDueDate: number;
};

// Las filas de tarea de los overviews vienen de un include, no del modulo de tasks, asi que el
// favorito de cada una se resuelve aqui con la misma tabla de union en vez de reusar tasks.repository.
async function attachFavorites<T extends OverviewTaskRowWithoutFavorite>(
  userId: string,
  tasks: T[],
): Promise<(T & { isFavorite: boolean })[]> {
  const favorites = await prisma.taskFavorite.findMany({
    where: { userId, taskId: { in: tasks.map((task) => task.id) } },
    select: { taskId: true },
  });

  const favoritedIds = new Set(favorites.map((favorite) => favorite.taskId));

  return tasks.map((task) => ({ ...task, isFavorite: favoritedIds.has(task.id) }));
}

// Las tres vistas reparten sus tareas abiertas en las mismas cubetas de fecha limite y solo cambia
// el ambito (las mias / las del workspace / las del proyecto), asi que las cuentas se piden aqui.
// La cuarta cubeta ("scheduled") la deduce el mapper restando estas tres a las tareas abiertas.
async function countOpenByDueDate(scope: Prisma.TaskWhereInput): Promise<DueDateBucketRows> {
  const now = new Date();
  const dueSoonUntil = new Date(now.getTime() + DUE_SOON_DAYS * 24 * 60 * 60 * 1000);
  const open: Prisma.TaskWhereInput = { ...scope, isArchived: false, status: { not: TaskStatus.DONE } };

  const [overdue, dueSoon, noDueDate] = await Promise.all([
    prisma.task.count({ where: { ...open, dueDate: { lt: now } } }),
    prisma.task.count({ where: { ...open, dueDate: { gte: now, lte: dueSoonUntil } } }),
    prisma.task.count({ where: { ...open, dueDate: null } }),
  ]);

  return { overdue, dueSoon, noDueDate };
}

export async function getMyOverview({ userId }: { userId: string }) {
  const velocitySince = new Date(Date.now() - VELOCITY_DAYS * 24 * 60 * 60 * 1000);

  const [tasksByStatus, byDueDate, completedLast7Days, myTasks] = await Promise.all([
    prisma.task.groupBy({
      by: ["status"],
      where: { assigneeId: userId, isArchived: false },
      _count: true,
    }),

    countOpenByDueDate({ assigneeId: userId }),

    prisma.task.count({
      where: { assigneeId: userId, isArchived: false, completedAt: { gte: velocitySince } },
    }),

    // Cola de trabajo, no historial: solo tareas vivas y ordenadas por urgencia (lo que vence
    // antes primero, lo que no tiene fecha al final), que es el orden en el que hay que atacarlas.
    prisma.task.findMany({
      where: { assigneeId: userId, isArchived: false, status: { not: TaskStatus.DONE } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { priority: "desc" }],
      take: TASK_LIST_LIMIT,
      include: overviewTaskInclude,
    }),
  ]);

  return {
    tasksByStatus,
    byDueDate,
    completedLast7Days,
    myTasks: await attachFavorites(userId, myTasks as OverviewTaskRowWithoutFavorite[]),
  };
}

export async function getWorkspaceOverview({ userId, workspaceId }: { userId: string; workspaceId: string }) {
  const velocitySince = new Date(Date.now() - VELOCITY_DAYS * 24 * 60 * 60 * 1000);

  const [projectsCount, tasksByStatus, byDueDate, completedLast7Days, recentTasks] = await Promise.all([
    prisma.project.count({
      where: { workspaceId, isArchived: false },
    }),

    prisma.task.groupBy({
      by: ["status"],
      where: { project: { workspaceId }, isArchived: false },
      _count: true,
    }),

    countOpenByDueDate({ project: { workspaceId } }),

    prisma.task.count({
      where: { project: { workspaceId }, isArchived: false, completedAt: { gte: velocitySince } },
    }),

    prisma.task.findMany({
      where: { project: { workspaceId }, isArchived: false },
      orderBy: { updatedAt: "desc" },
      take: TASK_LIST_LIMIT,
      include: overviewTaskInclude,
    }),
  ]);

  return {
    projectsCount,
    tasksByStatus,
    byDueDate,
    completedLast7Days,
    recentTasks: await attachFavorites(userId, recentTasks as OverviewTaskRowWithoutFavorite[]),
  };
}

export async function getProjectOverview({ userId, projectId }: { userId: string; projectId: string }) {
  const velocitySince = new Date(Date.now() - VELOCITY_DAYS * 24 * 60 * 60 * 1000);

  const [tasksByStatus, tasksByPriority, byDueDate, unassigned, completedLast7Days, recentTasks] = await Promise.all([
    prisma.task.groupBy({
      by: ["status"],
      where: { projectId, isArchived: false },
      _count: true,
    }),

    prisma.task.groupBy({
      by: ["priority"],
      where: { projectId, isArchived: false },
      _count: true,
    }),

    countOpenByDueDate({ projectId }),

    prisma.task.count({
      where: { projectId, isArchived: false, status: { not: TaskStatus.DONE }, assigneeId: null },
    }),

    prisma.task.count({
      where: { projectId, isArchived: false, completedAt: { gte: velocitySince } },
    }),

    prisma.task.findMany({
      where: { projectId, isArchived: false },
      orderBy: { updatedAt: "desc" },
      take: TASK_LIST_LIMIT,
      include: overviewTaskInclude,
    }),
  ]);

  return {
    tasksByStatus,
    tasksByPriority,
    byDueDate,
    unassigned,
    completedLast7Days,
    recentTasks: await attachFavorites(userId, recentTasks as OverviewTaskRowWithoutFavorite[]),
  };
}
