import { TaskPriority, TaskStatus } from "../../../shared/types/prisma.types.ts";
import { toTaskResponseDto } from "../../tasks/mappers/tasks.mapper.ts";
import type { MemberWorkloadRow, OverviewTaskRow, ProjectWorkloadRow } from "../overview.repository.ts";
import type {
  MemberWorkloadItemDto,
  MyOverviewResponseDto,
  OverviewTaskDto,
  ProjectOverviewResponseDto,
  ProjectWorkloadItemDto,
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

function toProjectWorkloadItemDto(row: ProjectWorkloadRow): ProjectWorkloadItemDto {
  return {
    projectId: row.id,
    name: row.name,
    slug: row.slug,
    openTasksCount: row._count.tasks,
  };
}

function toMemberWorkloadItemDto(row: MemberWorkloadRow): MemberWorkloadItemDto {
  return {
    userId: row.user.id,
    firstName: row.user.firstName,
    lastName: row.user.lastName,
    avatarUrl: row.user.avatarUrl,
    openTasksCount: row.user._count.assignedTasks,
  };
}

// La carga de trabajo se ordena de mas a menos y se queda con las primeras entradas: lo que
// interesa es quien (o que proyecto) esta mas saturado. Las filas con 0 tareas abiertas se
// descartan porque no son carga de trabajo: en un workspace de 43 proyectos llenaban la lista de
// filas vacias y tapaban justo la informacion que la tarjeta existe para dar.
const WORKLOAD_LIMIT = 8;

function sortByOpenTasksDesc<T extends { openTasksCount: number }>(items: T[]): T[] {
  return items
    .filter((item) => item.openTasksCount > 0)
    .sort((a, b) => b.openTasksCount - a.openTasksCount)
    .slice(0, WORKLOAD_LIMIT);
}

export function toMyOverviewResponseDto(data: {
  tasksByStatus: { status: TaskStatus; _count: number }[];
  overdue: number;
  dueSoon: number;
  noDueDate: number;
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

      byUrgency: {
        overdue: data.overdue,
        dueSoon: data.dueSoon,
        // El resto de tareas abiertas con fecha: ni vencidas ni dentro de los proximos 7 dias.
        scheduled: open - data.overdue - data.dueSoon - data.noDueDate,
        noDueDate: data.noDueDate,
      },
    },

    myTasks: data.myTasks.map(toOverviewTaskDto),
  };
}

export function toWorkspaceOverviewResponseDto(data: {
  projectsCount: number;
  membersCount: number;
  tasksByStatus: { status: TaskStatus; _count: number }[];
  overdue: number;
  completedLast7Days: number;
  workload: ProjectWorkloadRow[];
  recentTasks: OverviewTaskRow[];
}): WorkspaceOverviewResponseDto {
  const byStatus = fillStatusCounts(data.tasksByStatus);
  const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0);

  return {
    projectsCount: data.projectsCount,
    membersCount: data.membersCount,

    tasks: {
      byStatus,
      open: total - byStatus.DONE,
      overdue: data.overdue,
      completedLast7Days: data.completedLast7Days,
      completionRate: computeRate(byStatus.DONE, total),
    },

    workload: sortByOpenTasksDesc(data.workload.map(toProjectWorkloadItemDto)),

    recentTasks: data.recentTasks.map(toOverviewTaskDto),
  };
}

export function toProjectOverviewResponseDto(data: {
  tasksByStatus: { status: TaskStatus; _count: number }[];
  tasksByPriority: { priority: TaskPriority; _count: number }[];
  overdue: number;
  unassigned: number;
  completedLast7Days: number;
  workload: MemberWorkloadRow[];
  recentTasks: OverviewTaskRow[];
}): ProjectOverviewResponseDto {
  const byStatus = fillStatusCounts(data.tasksByStatus);
  const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0);

  return {
    tasks: {
      byStatus,
      byPriority: fillPriorityCounts(data.tasksByPriority),
      open: total - byStatus.DONE,
      overdue: data.overdue,
      unassigned: data.unassigned,
      completedLast7Days: data.completedLast7Days,
      completionRate: computeRate(byStatus.DONE, total),
    },

    workload: sortByOpenTasksDesc(data.workload.map(toMemberWorkloadItemDto)),

    recentTasks: data.recentTasks.map(toOverviewTaskDto),
  };
}
