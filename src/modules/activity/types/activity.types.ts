import type { ActivityAction, ProjectRole, TaskPriority, TaskStatus } from "../../../shared/types/prisma.types.ts";

// Lo que el historial necesita para escribir la frase y enlazar a la tarea. Se guarda aunque el
// evento tenga taskId: asi el feed de un proyecto se resuelve sin joins contra Task, y el titulo
// queda congelado en el momento del cambio, que es lo que un historial debe contar.
type TaskRef = {
  taskNumber: number;
  taskTitle: string;
};

type MemberRef = {
  targetUserId: string;
};

// Titulo y descripcion no tienen narrativa propia ("cambio el titulo" no dice nada util sin el
// diff), asi que comparten accion y solo se registra que campos se tocaron.
export type TaskEditedField = "title" | "description";

export type ActivityPayloadMap = {
  TASK_CREATED: TaskRef;
  TASK_EDITED: TaskRef & { fields: TaskEditedField[] };
  TASK_STATUS_CHANGED: TaskRef & { from: TaskStatus; to: TaskStatus };
  TASK_PRIORITY_CHANGED: TaskRef & { from: TaskPriority; to: TaskPriority };
  TASK_ASSIGNEE_CHANGED: TaskRef & { from: string | null; to: string | null };
  // Fechas en ISO: el payload es JSON, y un Date volveria como string igualmente.
  TASK_DUE_DATE_CHANGED: TaskRef & { from: string | null; to: string | null };
  TASK_ARCHIVED: TaskRef;
  COMMENT_CREATED: TaskRef & { commentId: string };
  PROJECT_MEMBER_ADDED: MemberRef & { role: ProjectRole };
  PROJECT_MEMBER_ROLE_CHANGED: MemberRef & { from: ProjectRole; to: ProjectRole };
  PROJECT_MEMBER_DEACTIVATED: MemberRef;
};

// Union discriminada por accion: el payload que se pasa tiene que ser el de esa accion y no otro.
export type ActivityEventInput = {
  [A in ActivityAction]: {
    action: A;
    workspaceId: string;
    projectId: string;
    taskId: string | null;
    actorId: string;
    payload: ActivityPayloadMap[A];
  };
}[ActivityAction];

// El nombre del actor no vive en el payload, se resuelve al leer para que el feed muestre siempre
// el actual. Este es el tipo que devuelve el repositorio.
export type ActivityEventWithActor = {
  id: string;
  workspaceId: string;
  projectId: string;
  taskId: string | null;
  action: ActivityAction;
  payload: unknown;
  createdAt: Date;
  actor: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
};
