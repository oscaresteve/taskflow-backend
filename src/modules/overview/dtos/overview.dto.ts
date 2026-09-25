import type { TaskPriority, TaskStatus } from "../../../shared/types/prisma.types.ts";
import type { TaskResponseDto } from "../../tasks/dtos/tasks.dto.ts";

// Fila de tarea de los overviews: la tarea mas el contexto que la UI necesita para pintarla
// entera (identificador tipo CORE-113, proyecto al que pertenece y responsable).
export type OverviewTaskDto = TaskResponseDto & {
  project: {
    key: string;
    slug: string;
    name: string;
    workspaceSlug: string;
  };
  assignee: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  } | null;
};

// Reparto de las tareas abiertas por fecha limite; las cuatro cubetas suman siempre `open`. Las
// tres vistas de overview lo pintan con la misma grafica, asi que el reparto es uno solo.
export type DueDateBucketsDto = {
  overdue: number;
  dueSoon: number;
  scheduled: number;
  noDueDate: number;
};

export type MyOverviewResponseDto = {
  tasks: {
    open: number;
    completedLast7Days: number;
    byDueDate: DueDateBucketsDto;
  };

  myTasks: OverviewTaskDto[];
};

export type WorkspaceOverviewResponseDto = {
  projectsCount: number;

  tasks: {
    byStatus: Record<TaskStatus, number>;
    byDueDate: DueDateBucketsDto;
    open: number;
    completedLast7Days: number;
    completionRate: number;
  };

  recentTasks: OverviewTaskDto[];
};

export type ProjectOverviewResponseDto = {
  tasks: {
    byStatus: Record<TaskStatus, number>;
    byPriority: Record<TaskPriority, number>;
    byDueDate: DueDateBucketsDto;
    open: number;
    unassigned: number;
    completedLast7Days: number;
    completionRate: number;
  };

  recentTasks: OverviewTaskDto[];
};
