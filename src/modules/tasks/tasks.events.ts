import type { ActivityEventInput, TaskEditedField } from "../activity/types/activity.types.ts";
import type { Task, TaskStatus } from "../../shared/types/prisma.types.ts";
import type { UpdateTaskDto } from "./schemas/tasks.schema.ts";

// Los eventos se construyen aqui, y no en el repositorio, porque el service es la unica capa que
// conoce el antes y el despues: el repositorio ya solo ve la fila nueva.

type TaskEventScope = {
  workspaceId: string;
  projectId: string;
  actorId: string;
  task: Task;
};

function toIsoOrNull(date: Date | string | null): string | null {
  if (date === null) return null;

  return new Date(date).toISOString();
}

export function buildTaskUpdateEvents({
  workspaceId,
  projectId,
  actorId,
  task,
  data,
}: TaskEventScope & { data: UpdateTaskDto }): ActivityEventInput[] {
  const base = { workspaceId, projectId, taskId: task.id, actorId };

  // El evento describe la tarea tal y como queda tras el cambio, asi que el titulo del payload es
  // el nuevo cuando la propia actualizacion lo cambia.
  const ref = { taskNumber: task.taskNumber, taskTitle: data.title ?? task.title };

  const events: ActivityEventInput[] = [];

  const editedFields: TaskEditedField[] = [];

  if (data.title !== undefined && data.title !== task.title) {
    editedFields.push("title");
  }

  if (data.description !== undefined && (data.description ?? null) !== task.description) {
    editedFields.push("description");
  }

  if (editedFields.length > 0) {
    events.push({ ...base, action: "TASK_EDITED", payload: { ...ref, fields: editedFields } });
  }

  if (data.status !== undefined && data.status !== task.status) {
    events.push({ ...base, action: "TASK_STATUS_CHANGED", payload: { ...ref, from: task.status, to: data.status } });
  }

  if (data.priority !== undefined && data.priority !== task.priority) {
    events.push({
      ...base,
      action: "TASK_PRIORITY_CHANGED",
      payload: { ...ref, from: task.priority, to: data.priority },
    });
  }

  if (data.assigneeId !== undefined && (data.assigneeId ?? null) !== task.assigneeId) {
    events.push({
      ...base,
      action: "TASK_ASSIGNEE_CHANGED",
      payload: { ...ref, from: task.assigneeId, to: data.assigneeId ?? null },
    });
  }

  if (data.dueDate !== undefined) {
    // Normalizar los dos lados a ISO: la fecha guardada es un Date y la entrante un string, y dos
    // representaciones del mismo instante no deben contar como cambio.
    const from = toIsoOrNull(task.dueDate);
    const to = toIsoOrNull(data.dueDate ?? null);

    if (from !== to) {
      events.push({ ...base, action: "TASK_DUE_DATE_CHANGED", payload: { ...ref, from, to } });
    }
  }

  return events;
}

// Mover solo cambia el rank la mayoria de las veces, y "Ana movio TF-14 dos posiciones" no es
// historial. Solo se registra el salto de columna.
export function buildTaskMoveEvents({
  workspaceId,
  projectId,
  actorId,
  task,
  status,
}: TaskEventScope & { status: TaskStatus }): ActivityEventInput[] {
  if (status === task.status) return [];

  return [
    {
      workspaceId,
      projectId,
      taskId: task.id,
      actorId,
      action: "TASK_STATUS_CHANGED",
      payload: { taskNumber: task.taskNumber, taskTitle: task.title, from: task.status, to: status },
    },
  ];
}

export function buildTaskArchivedEvents({
  workspaceId,
  projectId,
  actorId,
  task,
}: TaskEventScope): ActivityEventInput[] {
  return [
    {
      workspaceId,
      projectId,
      taskId: task.id,
      actorId,
      action: "TASK_ARCHIVED",
      payload: { taskNumber: task.taskNumber, taskTitle: task.title },
    },
  ];
}
