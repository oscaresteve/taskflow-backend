import { TaskPriority, TaskStatus } from "../../../shared/types/prisma.types.ts";
import { toTaskResponseDto } from "../../tasks/mappers/tasks.mapper.ts";
import { toProjectResponseDto } from "../../projects/mappers/projects.mapper.ts";
import type { PaginatedResponseDto } from "../../../shared/dtos/pagination.dto.ts";
import type { DueDateBucketRows, OverviewProjectRow, OverviewTaskRow, ProjectStatsRow } from "../overview.repository.ts";
import type {
  DueDateBucketsDto,
  OverviewProjectDto,
  ProjectStatsDto,
  MyOverviewResponseDto,
  OverviewTaskDto,
  ProjectOverviewResponseDto,
  WorkspaceOverviewResponseDto,
} from "../dtos/overview.dto.ts";

// El groupBy de Prisma solo devuelve los status/priority con al menos una tarea; completamos con
// 0 el resto para que el frontend no tenga que comprobar si una clave existe.
function fillStatusCounts(counts: { status: TaskStatus; _count: number }[]): Record<TaskStatus, number> {
  const result = Object.fromEntries(Object.values(TaskStatus).map((status) => [status, 0])) as Record<
    TaskStatus,
    number
  >;

  for (const { status, _count } of counts) {
    result[status] = _count;
  }

  return result;
}

function fillPriorityCounts(counts: { priority: TaskPriority; _count: number }[]): Record<TaskPriority, number> {
  const result = Object.fromEntries(Object.values(TaskPriority).map((priority) => [priority, 0])) as Record<
    TaskPriority,
    number
  >;

  for (const { priority, _count } of counts) {
    result[priority] = _count;
  }

  return result;
}

// Redondeado a un entero porcentual; 0 si no hay tareas sobre las que calcular la tasa (evita
// dividir por cero en vez de obligar al caller a comprobarlo antes de llamar).
function computeRate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;

  return Math.round((numerator / denominator) * 100);
}

// "scheduled" es el resto de tareas abiertas con fecha: ni vencidas ni dentro de los proximos 7
// dias. Se deduce en vez de contarse para que las cuatro cubetas sumen siempre las abiertas.
function toDueDateBucketsDto(rows: DueDateBucketRows, open: number): DueDateBucketsDto {
  return {
    overdue: rows.overdue,
    dueSoon: rows.dueSoon,
    scheduled: open - rows.overdue - rows.dueSoon - rows.noDueDate,
    noDueDate: rows.noDueDate,
  };
}

// Redondeado a un entero porcentual; 0 si el proyecto no tiene tareas sobre las que calcularlo.
function toProjectStatsDto(stats: ProjectStatsRow): ProjectStatsDto {
  return {
    open: stats.open,
    overdue: stats.overdue,
    completionRate: stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100),
    lastActivityAt: stats.lastActivityAt,
  };
}

export function toPaginatedOverviewProjectDto({
  projects,
  page,
  limit,
}: {
  projects: { items: OverviewProjectRow[]; total: number };
  page: number;
  limit: number;
}): PaginatedResponseDto<OverviewProjectDto> {
  return {
    data: projects.items.map((project) => ({
      ...toProjectResponseDto(project),
      stats: toProjectStatsDto(project.stats),
    })),

    pagination: {
      page,
      limit,
      total: projects.total,
      pages: Math.ceil(projects.total / limit),
    },
  };
}

function toOverviewTaskDto(task: OverviewTaskRow): OverviewTaskDto {
  return {
    ...toTaskResponseDto(task),
    project: {
      key: task.project.key,
      slug: task.project.slug,
      name: task.project.name,
      workspaceSlug: task.project.workspace.slug,
    },
    assignee: task.assignee,
  };
}

export function toMyOverviewResponseDto(data: {
  tasksByStatus: { status: TaskStatus; _count: number }[];
  byDueDate: DueDateBucketRows;
  completedLast7Days: number;
  myTasks: OverviewTaskRow[];
}): MyOverviewResponseDto {
  const byStatus = fillStatusCounts(data.tasksByStatus);
  const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
  const open = total - byStatus.DONE;

  return {
    tasks: {
      open,
      completedLast7Days: data.completedLast7Days,
      byDueDate: toDueDateBucketsDto(data.byDueDate, open),
    },

    myTasks: data.myTasks.map(toOverviewTaskDto),
  };
}

export function toWorkspaceOverviewResponseDto(data: {
  projectsCount: number;
  open: number;
  overdue: number;
  unassigned: number;
  completedLast7Days: number;
  myTasks: OverviewTaskRow[];
  recentTasks: OverviewTaskRow[];
}): WorkspaceOverviewResponseDto {
  return {
    projectsCount: data.projectsCount,

    tasks: {
      open: data.open,
      overdue: data.overdue,
      unassigned: data.unassigned,
      completedLast7Days: data.completedLast7Days,
    },

    myTasks: data.myTasks.map(toOverviewTaskDto),
    recentTasks: data.recentTasks.map(toOverviewTaskDto),
  };
}

export function toProjectOverviewResponseDto(data: {
  tasksByStatus: { status: TaskStatus; _count: number }[];
  tasksByPriority: { priority: TaskPriority; _count: number }[];
  byDueDate: DueDateBucketRows;
  unassigned: number;
  completedLast7Days: number;
  recentTasks: OverviewTaskRow[];
}): ProjectOverviewResponseDto {
  const byStatus = fillStatusCounts(data.tasksByStatus);
  const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
  const open = total - byStatus.DONE;

  return {
    tasks: {
      byStatus,
      byPriority: fillPriorityCounts(data.tasksByPriority),
      byDueDate: toDueDateBucketsDto(data.byDueDate, open),
      open,
      unassigned: data.unassigned,
      completedLast7Days: data.completedLast7Days,
      completionRate: computeRate(byStatus.DONE, total),
    },

    recentTasks: data.recentTasks.map(toOverviewTaskDto),
  };
}
