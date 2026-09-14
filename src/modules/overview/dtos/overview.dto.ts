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

export type ProjectWorkloadItemDto = {
  projectId: string;
  name: string;
  slug: string;
  openTasksCount: number;
};

export type MemberWorkloadItemDto = {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  openTasksCount: number;
};

export type MyOverviewResponseDto = {
  tasks: {
    open: number;
    completedLast7Days: number;

    // Reparto de las tareas abiertas por urgencia; las cuatro suman `open`.
    byUrgency: {
      overdue: number;
      dueSoon: number;
      scheduled: number;
      noDueDate: number;
    };
  };

  myTasks: OverviewTaskDto[];
};

export type WorkspaceOverviewResponseDto = {
  projectsCount: number;
  membersCount: number;

  tasks: {
    byStatus: Record<TaskStatus, number>;
    open: number;
    overdue: number;
    completedLast7Days: number;
    completionRate: number;
  };

  workload: ProjectWorkloadItemDto[];

  recentTasks: OverviewTaskDto[];
};

export type ProjectOverviewResponseDto = {
  tasks: {
    byStatus: Record<TaskStatus, number>;
    byPriority: Record<TaskPriority, number>;
    open: number;
    overdue: number;
    unassigned: number;
    completedLast7Days: number;
    completionRate: number;
  };

  workload: MemberWorkloadItemDto[];

  recentTasks: OverviewTaskDto[];
};
