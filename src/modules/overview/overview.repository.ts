import { prisma } from "../../config/prisma.ts";
import { TaskStatus, WorkspaceMemberStatus } from "../../shared/types/prisma.types.ts";
import { Prisma } from "../../prisma/generated/prisma/client.ts";
import type { Project, Task, Workspace } from "../../shared/types/prisma.types.ts";

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

// Un proyecto solo cuenta para el usuario si esta activo y el es miembro activo de el: lo que no
// cumple eso no se puede abrir desde ninguna pantalla, asi que tampoco debe sumar en ningun
// contador ni aparecer en ninguna lista. Los contadores del espacio y la rejilla de proyectos
// tienen que cuadrar, y antes no lo hacian: el espacio contaba todo y la rejilla solo lo tuyo.
function myProjects(userId: string): Prisma.ProjectWhereInput {
  return { isArchived: false, members: { some: { userId, isActive: true } } };
}

// Las dos rejillas buscan igual: por nombre o descripcion, sin distinguir mayusculas.
function nameOrDescriptionContains(search: string) {
  const contains = { contains: search, mode: "insensitive" } as const;

  return [{ name: contains }, { description: contains }];
}

export type ProjectStatsRow = {
  total: number;
  done: number;
  open: number;
  overdue: number;
  lastActivityAt: Date | null;
};

export type OverviewProjectRow = Project & {
  isFavorite: boolean;
  stats: ProjectStatsRow;
};

const EMPTY_PROJECT_STATS: ProjectStatsRow = { total: 0, done: 0, open: 0, overdue: 0, lastActivityAt: null };

// Los numeros que pinta la tarjeta de cada proyecto, en una sola pasada sobre las tareas de la
// pagina. Va en SQL crudo porque el _count de Prisma solo admite un filtro por relacion y aqui
// hacen falta cuatro cuentas distintas mas el ultimo updatedAt. El limite de "vencida" viaja como
// texto ISO porque Postgres convertiria un timestamptz casteado a timestamp con el timezone de la
// sesion, y la columna guarda UTC.
async function countProjectStats({
  projectIds,
  now,
}: {
  projectIds: string[];
  now: Date;
}): Promise<Map<string, ProjectStatsRow>> {
  const rows = await prisma.$queryRaw<({ projectId: string } & ProjectStatsRow)[]>`
    SELECT
      task."projectId" AS "projectId",
      COUNT(*)::int AS "total",
      COUNT(*) FILTER (WHERE task.status = 'DONE')::int AS "done",
      COUNT(*) FILTER (WHERE task.status <> 'DONE')::int AS "open",
      COUNT(*) FILTER (WHERE task.status <> 'DONE' AND task."dueDate" < ${now.toISOString()}::timestamp)::int AS "overdue",
      MAX(task."updatedAt") AS "lastActivityAt"
    FROM "Task" task
    WHERE task."projectId" IN (${Prisma.join(projectIds)})
      AND task."isArchived" = false
    GROUP BY 1
  `;

  return new Map(rows.map(({ projectId, ...stats }) => [projectId, stats]));
}

// La rejilla de proyectos del overview del espacio: la misma membresia que el listado de gestion
// (solo los proyectos de los que eres miembro activo), pero con orden fijo por nombre y con los
// numeros de cada tarjeta. Un proyecto sin tareas no vuelve del recuento y se completa con ceros.
export async function findWorkspaceProjects({
  userId,
  workspaceId,
  page,
  limit,
  search,
}: {
  userId: string;
  workspaceId: string;
  page: number;
  limit: number;
  search?: string;
}): Promise<{ items: OverviewProjectRow[]; total: number }> {
  const where: Prisma.ProjectWhereInput = { ...myProjects(userId), workspaceId };

  if (search) {
    where.OR = nameOrDescriptionContains(search);
  }

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),

    prisma.project.count({ where }),
  ]);

  if (projects.length === 0) return { items: [], total };

  const projectIds = projects.map((project) => project.id);

  const [stats, favorites] = await Promise.all([
    countProjectStats({ projectIds, now: new Date() }),

    prisma.projectFavorite.findMany({
      where: { userId, projectId: { in: projectIds } },
      select: { projectId: true },
    }),
  ]);

  const favoritedIds = new Set(favorites.map((favorite) => favorite.projectId));

  return {
    items: projects.map((project) => ({
      ...project,
      isFavorite: favoritedIds.has(project.id),
      stats: stats.get(project.id) ?? EMPTY_PROJECT_STATS,
    })),
    total,
  };
}

type MyWorkspaceStatsRow = {
  open: number;
  overdue: number;
};

export type OverviewWorkspaceRow = Workspace & {
  isFavorite: boolean;
  stats: MyWorkspaceStatsRow;
};

const EMPTY_MY_WORKSPACE_STATS: MyWorkspaceStatsRow = { open: 0, overdue: 0 };

// Cuanto trabajo propio tiene el usuario en cada espacio, en una sola pasada. Son las mismas tareas
// que cuenta getMyOverview (asignadas, sin cerrar y en un proyecto activo del que eres miembro), asi
// que las tarjetas suman siempre el total del donut de "Foco".
async function countMyWorkspaceStats({
  userId,
  workspaceIds,
  now,
}: {
  userId: string;
  workspaceIds: string[];
  now: Date;
}): Promise<Map<string, MyWorkspaceStatsRow>> {
  const rows = await prisma.$queryRaw<({ workspaceId: string } & MyWorkspaceStatsRow)[]>`
    SELECT
      project."workspaceId" AS "workspaceId",
      COUNT(*)::int AS "open",
      COUNT(*) FILTER (WHERE task."dueDate" < ${now.toISOString()}::timestamp)::int AS "overdue"
    FROM "Task" task
    JOIN "Project" project ON project."id" = task."projectId"
    JOIN "ProjectMember" member
      ON member."projectId" = project."id" AND member."userId" = ${userId} AND member."isActive" = true
    WHERE project."workspaceId" IN (${Prisma.join(workspaceIds)})
      AND project."isArchived" = false
      AND task."assigneeId" = ${userId}
      AND task."isArchived" = false
      AND task.status <> 'DONE'
    GROUP BY 1
  `;

  return new Map(rows.map(({ workspaceId, ...stats }) => [workspaceId, stats]));
}

// La rejilla de espacios de My Space: los espacios activos de los que el usuario es miembro activo,
// con la carga propia de cada uno. Misma membresia y mismo orden fijo por nombre que el listado de
// gestion, sin sus filtros.
export async function findMyWorkspaces({
  userId,
  page,
  limit,
  search,
}: {
  userId: string;
  page: number;
  limit: number;
  search?: string;
}): Promise<{ items: OverviewWorkspaceRow[]; total: number }> {
  const where: Prisma.WorkspaceWhereInput = {
    isActive: true,
    members: { some: { userId, status: WorkspaceMemberStatus.ACTIVE } },
  };

  if (search) {
    where.OR = nameOrDescriptionContains(search);
  }

  const [workspaces, total] = await Promise.all([
    prisma.workspace.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),

    prisma.workspace.count({ where }),
  ]);

  if (workspaces.length === 0) return { items: [], total };

  const workspaceIds = workspaces.map((workspace) => workspace.id);

  const [stats, favorites] = await Promise.all([
    countMyWorkspaceStats({ userId, workspaceIds, now: new Date() }),

    prisma.workspaceFavorite.findMany({
      where: { userId, workspaceId: { in: workspaceIds } },
      select: { workspaceId: true },
    }),
  ]);

  const favoritedIds = new Set(favorites.map((favorite) => favorite.workspaceId));

  return {
    items: workspaces.map((workspace) => ({
      ...workspace,
      isFavorite: favoritedIds.has(workspace.id),
      stats: stats.get(workspace.id) ?? EMPTY_MY_WORKSPACE_STATS,
    })),
    total,
  };
}

export async function getMyOverview({ userId }: { userId: string }) {
  const velocitySince = new Date(Date.now() - VELOCITY_DAYS * 24 * 60 * 60 * 1000);

  // Lo propio, pero solo donde se puede llegar: proyecto activo del que eres miembro, en un espacio
  // que sigue activo.
  const mine: Prisma.TaskWhereInput = {
    assigneeId: userId,
    isArchived: false,
    project: { ...myProjects(userId), workspace: { isActive: true } },
  };

  const [tasksByStatus, byDueDate, completedLast7Days, myTasks] = await Promise.all([
    prisma.task.groupBy({
      by: ["status"],
      where: mine,
      _count: true,
    }),

    countOpenByDueDate(mine),

    prisma.task.count({
      where: { ...mine, completedAt: { gte: velocitySince } },
    }),

    // Cola de trabajo, no historial: solo tareas vivas y ordenadas por urgencia (lo que vence
    // antes primero, lo que no tiene fecha al final), que es el orden en el que hay que atacarlas.
    prisma.task.findMany({
      where: { ...mine, status: { not: TaskStatus.DONE } },
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
  const now = new Date();
  const velocitySince = new Date(now.getTime() - VELOCITY_DAYS * 24 * 60 * 60 * 1000);

  // El espacio resume con cinco numeros y dos listas: el reparto por estado y por fecha limite se
  // ve dentro de cada proyecto, y aqui cada proyecto trae los suyos en su tarjeta.
  const projects: Prisma.ProjectWhereInput = { ...myProjects(userId), workspaceId };
  const tasks: Prisma.TaskWhereInput = { project: projects, isArchived: false };
  const openTasks: Prisma.TaskWhereInput = { ...tasks, status: { not: TaskStatus.DONE } };

  const [projectsCount, open, overdue, unassigned, completedLast7Days, myTasks, recentTasks] = await Promise.all([
    prisma.project.count({ where: projects }),

    prisma.task.count({ where: openTasks }),

    prisma.task.count({ where: { ...openTasks, dueDate: { lt: now } } }),

    prisma.task.count({ where: { ...openTasks, assigneeId: null } }),

    prisma.task.count({
      where: { ...tasks, completedAt: { gte: velocitySince } },
    }),

    // La misma cola que My Space, acotada a este espacio: lo que vence antes primero.
    prisma.task.findMany({
      where: { ...openTasks, assigneeId: userId },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { priority: "desc" }],
      take: TASK_LIST_LIMIT,
      include: overviewTaskInclude,
    }),

    prisma.task.findMany({
      where: tasks,
      orderBy: { updatedAt: "desc" },
      take: TASK_LIST_LIMIT,
      include: overviewTaskInclude,
    }),
  ]);

  return {
    projectsCount,
    open,
    overdue,
    unassigned,
    completedLast7Days,
    myTasks: await attachFavorites(userId, myTasks as OverviewTaskRowWithoutFavorite[]),
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
