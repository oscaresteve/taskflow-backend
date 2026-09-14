import { prisma } from "../../config/prisma.ts";
import { TaskStatus } from "../../shared/types/prisma.types.ts";
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
  project: { key: string; slug: string; name: string; workspace: { slug: string } };
  assignee: { id: string; firstName: string; lastName: string; avatarUrl: string | null } | null;
};

export type ProjectWorkloadRow = {
  id: string;
  name: string;
  slug: string;
  _count: { tasks: number };
};

export type MemberWorkloadRow = {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    _count: { assignedTasks: number };
  };
};

export async function getMyOverview({ userId }: { userId: string }) {
  const now = new Date();
  const dueSoonUntil = new Date(now.getTime() + DUE_SOON_DAYS * 24 * 60 * 60 * 1000);
  const velocitySince = new Date(now.getTime() - VELOCITY_DAYS * 24 * 60 * 60 * 1000);

  const [tasksByStatus, overdue, dueSoon, noDueDate, completedLast7Days, myTasks] = await Promise.all([
    prisma.task.groupBy({
      by: ["status"],
      where: { assigneeId: userId, isArchived: false },
      _count: true,
    }),

    prisma.task.count({
      where: {
        assigneeId: userId,
        isArchived: false,
        status: { not: TaskStatus.DONE },
        dueDate: { lt: now },
      },
    }),

    prisma.task.count({
      where: {
        assigneeId: userId,
        isArchived: false,
        status: { not: TaskStatus.DONE },
        dueDate: { gte: now, lte: dueSoonUntil },
      },
    }),

    prisma.task.count({
      where: { assigneeId: userId, isArchived: false, status: { not: TaskStatus.DONE }, dueDate: null },
    }),

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
    overdue,
    dueSoon,
    noDueDate,
    completedLast7Days,
    myTasks: myTasks as OverviewTaskRow[],
  };
}

export async function getWorkspaceOverview({ workspaceId }: { workspaceId: string }) {
  const now = new Date();
  const velocitySince = new Date(now.getTime() - VELOCITY_DAYS * 24 * 60 * 60 * 1000);

  const [projectsCount, membersCount, tasksByStatus, overdue, completedLast7Days, workload, recentTasks] =
    await Promise.all([
      prisma.project.count({
        where: { workspaceId, isArchived: false },
      }),

      prisma.workspaceMember.count({
        where: { workspaceId, status: "ACTIVE" },
      }),

      prisma.task.groupBy({
        by: ["status"],
        where: { project: { workspaceId }, isArchived: false },
        _count: true,
      }),

      prisma.task.count({
        where: {
          project: { workspaceId },
          isArchived: false,
          status: { not: TaskStatus.DONE },
          dueDate: { lt: now },
        },
      }),

      prisma.task.count({
        where: { project: { workspaceId }, isArchived: false, completedAt: { gte: velocitySince } },
      }),

      prisma.project.findMany({
        where: { workspaceId, isArchived: false },
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { tasks: { where: { isArchived: false, status: { not: TaskStatus.DONE } } } } },
        },
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
    membersCount,
    tasksByStatus,
    overdue,
    completedLast7Days,
    workload: workload as ProjectWorkloadRow[],
    recentTasks: recentTasks as OverviewTaskRow[],
  };
}

export async function getProjectOverview({ projectId }: { projectId: string }) {
  const now = new Date();
  const velocitySince = new Date(now.getTime() - VELOCITY_DAYS * 24 * 60 * 60 * 1000);

  const [tasksByStatus, tasksByPriority, overdue, unassigned, completedLast7Days, workload, recentTasks] =
    await Promise.all([
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

      prisma.task.count({
        where: { projectId, isArchived: false, status: { not: TaskStatus.DONE }, dueDate: { lt: now } },
      }),

      prisma.task.count({
        where: { projectId, isArchived: false, status: { not: TaskStatus.DONE }, assigneeId: null },
      }),

      prisma.task.count({
        where: { projectId, isArchived: false, completedAt: { gte: velocitySince } },
      }),

      prisma.projectMember.findMany({
        where: { projectId, isActive: true },
        select: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              _count: {
                select: {
                  assignedTasks: { where: { projectId, isArchived: false, status: { not: TaskStatus.DONE } } },
                },
              },
            },
          },
        },
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
    overdue,
    unassigned,
    completedLast7Days,
    workload: workload as MemberWorkloadRow[],
    recentTasks: recentTasks as OverviewTaskRow[],
  };
}
