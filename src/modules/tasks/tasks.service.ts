import type { CreateTaskDto, MoveTaskDto, TaskQueryDto, UpdateTaskDto } from "./schemas/tasks.schema.ts";
import { type Task } from "../../shared/types/prisma.types.ts";
import * as tasksRepository from "./tasks.repository.ts";
import { BadRequestError } from "../../shared/errors/bad-request-error.ts";
import { ConflictError } from "../../shared/errors/conflict-error.ts";
import { NotFoundError } from "../../shared/errors/not-found-error.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import * as authorizationService from "../../shared/auth/authorization.service.ts";
import { requireProjectManager } from "../../shared/auth/permissions.ts";
import { buildTaskArchivedEvents, buildTaskMoveEvents, buildTaskUpdateEvents } from "./tasks.events.ts";
import { emitTaskReordered } from "../../socket/realtime.ts";

// LLamar al repository y realizar toda la lógica necesaria

export async function create({
  data,
  userId,
  workspaceSlug,
  projectSlug,
}: {
  data: CreateTaskDto;
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
}): Promise<Task & { isFavorite: boolean }> {
  // Obtener el contexto
  const { project } = await authorizationService.getProjectContext({
    userId,
    workspaceSlug,
    projectSlug,
  });

  // Combrobar que el objetivo es miembro
  if (data.assigneeId) {
    await authorizationService.getProjectMemberTarget({
      projectId: project.id,
      projectMemberUserId: data.assigneeId,
    });
  }

  // Las tareas nacen en TODO (createTaskSchema no acepta status), al final de esa columna.
  const rank = await tasksRepository.getNextTaskRank({ projectId: project.id, status: "TODO" });

  const task = await tasksRepository.create({
    data,
    userId,
    projectId: project.id,
    workspaceId: project.workspaceId,
    rank,
  });

  // Una tarea recien creada no puede estar marcada como favorita todavia
  return { ...task, isFavorite: false };
}

export async function findAll({
  query,
  userId,
  timeZone,
  workspaceSlug,
  projectSlug,
}: {
  query: TaskQueryDto;
  userId: string;
  timeZone: string | null;
  workspaceSlug: string;
  projectSlug: string;
}): Promise<PaginatedResult<Task & { isFavorite: boolean }>> {
  // Obtener el contexto
  const { project } = await authorizationService.getProjectContext({
    userId,
    workspaceSlug,
    projectSlug,
  });

  const tasks = await tasksRepository.findAll({ projectId: project.id, userId, timeZone, query });

  const favoritedIds = await tasksRepository.findFavoritedIds({
    userId,
    taskIds: tasks.items.map((task) => task.id),
  });

  return {
    items: tasks.items.map((task) => ({ ...task, isFavorite: favoritedIds.has(task.id) })),
    total: tasks.total,
  };
}

export async function findBoard({
  userId,
  workspaceSlug,
  projectSlug,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
}): Promise<(Task & { isFavorite: boolean })[]> {
  const { project } = await authorizationService.getProjectContext({
    userId,
    workspaceSlug,
    projectSlug,
  });

  const tasks = await tasksRepository.findAllForBoard(project.id);

  const favoritedIds = await tasksRepository.findFavoritedIds({
    userId,
    taskIds: tasks.map((task) => task.id),
  });

  return tasks.map((task) => ({ ...task, isFavorite: favoritedIds.has(task.id) }));
}

export async function findByTaskNumber({
  userId,
  workspaceSlug,
  projectSlug,
  taskNumber,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
  taskNumber: number;
}): Promise<Task & { isFavorite: boolean }> {
  // Obtener contexto
  const { task } = await authorizationService.getTaskContext({ userId, workspaceSlug, projectSlug, taskNumber });

  const isFavorite = await tasksRepository.isFavorited({ userId, taskId: task.id });

  return { ...task, isFavorite };
}

export async function update({
  data,
  userId,
  workspaceSlug,
  projectSlug,
  taskNumber,
}: {
  data: UpdateTaskDto;
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
  taskNumber: number;
}): Promise<Task & { isFavorite: boolean }> {
  // Obtener contexto
  const { project, task } = await authorizationService.getTaskContext({
    userId,
    workspaceSlug,
    projectSlug,
    taskNumber,
  });

  // Combrobar que el objetivo es miembro, solo si cambia
  if (data.assigneeId && data.assigneeId !== task.assigneeId) {
    await authorizationService.getProjectMemberTarget({
      projectId: project.id,
      projectMemberUserId: data.assigneeId,
    });
  }

  // Comprobar que no este archivada
  if (task.isArchived) {
    throw new BadRequestError("Archived tasks cannot be updated");
  }

  // Marcar fecha de completado
  let completedAt = task.completedAt;

  if (data.status === "DONE" && task.status !== "DONE") {
    completedAt = new Date();
  }

  if (data.status && data.status !== "DONE") {
    completedAt = null;
  }

  const events = buildTaskUpdateEvents({
    workspaceId: project.workspaceId,
    projectId: project.id,
    actorId: userId,
    task,
    data,
  });

  const [updatedTask, isFavorite] = await Promise.all([
    tasksRepository.update({ projectId: project.id, taskNumber, data, completedAt, events }),
    tasksRepository.isFavorited({ userId, taskId: task.id }),
  ]);

  return { ...updatedTask, isFavorite };
}

export async function move({
  data,
  userId,
  workspaceSlug,
  projectSlug,
  taskNumber,
}: {
  data: MoveTaskDto;
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
  taskNumber: number;
}): Promise<Task & { isFavorite: boolean }> {
  // Obtener contexto
  const { project, task } = await authorizationService.getTaskContext({
    userId,
    workspaceSlug,
    projectSlug,
    taskNumber,
  });

  // Comprobar que no este archivada
  if (task.isArchived) {
    throw new BadRequestError("Archived tasks cannot be moved");
  }

  // Validar el ancla: debe ser una tarea viva del mismo proyecto y de la columna destino. Solo se
  // valida aqui para poder dar un error preciso; el rank se relee dentro de la transaccion.
  if (data.afterTaskId) {
    if (data.afterTaskId === task.id) {
      throw new BadRequestError("A task cannot be placed after itself");
    }

    const anchor = await tasksRepository.findById(data.afterTaskId);

    if (!anchor || anchor.projectId !== project.id || anchor.isArchived) {
      throw new NotFoundError("Anchor task not found");
    }

    if (anchor.status !== data.status) {
      throw new BadRequestError("Anchor task does not belong to the destination column");
    }
  }

  // Marcar fecha de completado, misma regla que update
  let completedAt = task.completedAt;

  if (data.status === "DONE" && task.status !== "DONE") {
    completedAt = new Date();
  }

  if (data.status !== "DONE") {
    completedAt = null;
  }

  const events = buildTaskMoveEvents({
    workspaceId: project.workspaceId,
    projectId: project.id,
    actorId: userId,
    task,
    status: data.status,
  });

  const movedTask = await tasksRepository.move({
    projectId: project.id,
    task,
    status: data.status,
    afterTaskId: data.afterTaskId,
    completedAt,
    events,
  });

  // El ancla dejo de ser valida entre la validacion y la transaccion (otro usuario la archivo o la
  // movio de columna). Se rechaza en vez de colocar la tarea en un sitio arbitrario.
  if (!movedTask) {
    throw new NotFoundError("Anchor task not found");
  }

  // El unico mensaje que no sale de record: una reordenacion dentro de la misma columna no narra
  // nada, asi que no deja evento, pero el tablero de los demas si tiene que enterarse. Se manda
  // siempre; el cliente solo invalida, asi que repetirlo cuando ademas hubo cambio de columna no
  // cuesta nada.
  emitTaskReordered(project.id, {
    actorId: userId,
    taskId: movedTask.id,
    status: movedTask.status,
    rank: movedTask.rank,
  });

  const isFavorite = await tasksRepository.isFavorited({ userId, taskId: movedTask.id });

  return { ...movedTask, isFavorite };
}

export async function archive({
  userId,
  workspaceSlug,
  projectSlug,
  taskNumber,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
  taskNumber: number;
}): Promise<void> {
  // Obtener contexto
  const { project, projectMember, task } = await authorizationService.getTaskContext({
    userId,
    workspaceSlug,
    projectSlug,
    taskNumber,
  });

  // Comprobar permisos
  requireProjectManager(projectMember);

  // Comprobar que no este archivada
  if (task.isArchived) {
    throw new BadRequestError("Task is already archived");
  }

  const events = buildTaskArchivedEvents({
    workspaceId: project.workspaceId,
    projectId: project.id,
    actorId: userId,
    task,
  });

  await tasksRepository.archive({ projectId: project.id, taskNumber, events });
}

export async function favorite({
  userId,
  workspaceSlug,
  projectSlug,
  taskNumber,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
  taskNumber: number;
}): Promise<void> {
  // Obtener contexto
  const { task } = await authorizationService.getTaskContext({ userId, workspaceSlug, projectSlug, taskNumber });

  // Comprobar que no este ya marcada como favorita
  if (await tasksRepository.isFavorited({ userId, taskId: task.id })) {
    throw new ConflictError("Task is already favorited");
  }

  await tasksRepository.createFavorite({ userId, taskId: task.id });
}

export async function unfavorite({
  userId,
  workspaceSlug,
  projectSlug,
  taskNumber,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
  taskNumber: number;
}): Promise<void> {
  // Obtener contexto
  const { task } = await authorizationService.getTaskContext({ userId, workspaceSlug, projectSlug, taskNumber });

  // Comprobar que este marcada como favorita
  if (!(await tasksRepository.isFavorited({ userId, taskId: task.id }))) {
    throw new NotFoundError("Task is not favorited");
  }

  await tasksRepository.deleteFavorite({ userId, taskId: task.id });
}
