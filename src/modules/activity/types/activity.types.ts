import type {
  ActivityAction,
  ProjectRole,
  TaskPriority,
  TaskStatus,
  WorkspaceRole,
} from "../../../shared/types/prisma.types.ts";

// Lo que el historial necesita para escribir la frase y enlazar a la entidad. Se guarda aunque el
// evento tenga el id delante: asi un feed se resuelve sin joins contra Task o Project, y el nombre
// queda congelado en el momento del cambio, que es lo que un historial debe contar.
type TaskRef = {
  taskNumber: number;
  taskTitle: string;
};

type ProjectRef = {
  projectName: string;
  projectKey: string;
};

type WorkspaceRef = {
  workspaceName: string;
};

type MemberRef = {
  targetUserId: string;
};

// Los campos sin narrativa propia comparten accion y solo registran cuales se tocaron. La frase se
// compone luego con las etiquetas de cada campo, asi que la lista crece sin tocar los mensajes.
export type TaskEditedField = "title" | "description";
export type ProjectEditedField = "name" | "description" | "color";
export type WorkspaceEditedField = "name" | "description" | "avatar";

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
  COMMENT_EDITED: TaskRef & { commentId: string };
  COMMENT_DELETED: TaskRef & { commentId: string };

  PROJECT_CREATED: ProjectRef;
  PROJECT_UPDATED: ProjectRef & { fields: ProjectEditedField[] };
  PROJECT_ARCHIVED: ProjectRef;

  PROJECT_MEMBER_ADDED: MemberRef & { role: ProjectRole };
  PROJECT_MEMBER_ROLE_CHANGED: MemberRef & { from: ProjectRole; to: ProjectRole };
  PROJECT_MEMBER_DEACTIVATED: MemberRef;

  WORKSPACE_CREATED: WorkspaceRef;
  WORKSPACE_UPDATED: WorkspaceRef & { fields: WorkspaceEditedField[] };
  WORKSPACE_DEACTIVATED: WorkspaceRef;

  WORKSPACE_MEMBER_INVITED: MemberRef & { role: WorkspaceRole };
  WORKSPACE_MEMBER_ACTIVATED: MemberRef;
  WORKSPACE_MEMBER_ROLE_CHANGED: MemberRef & { from: WorkspaceRole; to: WorkspaceRole };
  WORKSPACE_MEMBER_REMOVED: MemberRef;
};

// Union discriminada por accion: el payload que se pasa tiene que ser el de esa accion y no otro.
export type ActivityEventInput = {
  [A in ActivityAction]: {
    action: A;
    workspaceId: string;
    projectId: string | null;
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
  projectId: string | null;
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
  // El feed de espacio mezcla proyectos, asi que cada entrada tiene que saber enlazar al suyo. El
  // slug se resuelve al leer y no desde el payload porque renombrar un proyecto lo cambia.
  project: {
    slug: string;
    key: string;
    name: string;
  } | null;
};
