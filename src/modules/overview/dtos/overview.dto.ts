import type { TaskPriority, TaskStatus } from "../../../shared/types/prisma.types.ts";
import type { TaskResponseDto } from "../../tasks/dtos/tasks.dto.ts";
import type { ProjectResponseDto } from "../../projects/dtos/projects.dto.ts";
import type { WorkspaceResponseDto } from "../../workspaces/dtos/workspaces.dto.ts";

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

// Numeros del proyecto en la rejilla del overview: lo que necesita su tarjeta para decir como va
// sin abrirlo. `lastActivityAt` es el ultimo cambio en cualquiera de sus tareas, null si no tiene.
export type ProjectStatsDto = {
  open: number;
  overdue: number;
  completionRate: number;
  lastActivityAt: Date | null;
};

export type OverviewProjectDto = ProjectResponseDto & {
  stats: ProjectStatsDto;
};

// Carga propia del usuario en un espacio: las mismas tareas que cuenta su resumen de My Space.
export type MyWorkspaceStatsDto = {
  open: number;
  overdue: number;
};

export type OverviewWorkspaceDto = WorkspaceResponseDto & {
  stats: MyWorkspaceStatsDto;
};

// El espacio no reparte sus tareas en graficas: eso se ve dentro de cada proyecto, y cada proyecto
// trae sus propios numeros en el listado. Aqui solo van los cinco contadores de cabecera, la cola
// propia del usuario en este espacio y lo ultimo que se ha movido.
export type WorkspaceOverviewResponseDto = {
  projectsCount: number;

  tasks: {
    open: number;
    overdue: number;
    unassigned: number;
    completedLast7Days: number;
  };

  myTasks: OverviewTaskDto[];
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

};
