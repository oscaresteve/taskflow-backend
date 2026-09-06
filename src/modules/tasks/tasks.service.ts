import type { CreateTaskDto, MoveTaskDto, TaskQueryDto, UpdateTaskDto } from "./schemas/tasks.schema.ts";
import { type Task } from "../../shared/types/prisma.types.ts";
import * as tasksRepository from "./tasks.repository.ts";
import { BadRequestError } from "../../shared/errors/bad-request-error.ts";
import { NotFoundError } from "../../shared/errors/not-found-error.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import * as authorizationService from "../../shared/auth/authorization.service.ts";
import { requireProjectManager } from "../../shared/auth/permissions.ts";

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
}): Promise<Task> {
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

  const task = await tasksRepository.create({ data, userId, projectId: project.id, rank });

  return task;
}

export async function findAll({
  query,
  userId,
  workspaceSlug,
  projectSlug,
}: {
  query: TaskQueryDto;
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
}): Promise<PaginatedResult<Task>> {
  // Obtener el contexto
  const { project } = await authorizationService.getProjectContext({
    userId,
    workspaceSlug,
    projectSlug,
  });

  const tasks = await tasksRepository.findAll({ projectId: project.id, query });

  return tasks;
}

export async function findBoard({
  userId,
  workspaceSlug,
  projectSlug,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
}): Promise<Task[]> {
  const { project } = await authorizationService.getProjectContext({
    userId,
    workspaceSlug,
    projectSlug,
  });

  return tasksRepository.findAllForBoard(project.id);
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
}): Promise<Task> {
  // Obtener contexto
  const { task } = await authorizationService.getTaskContext({ userId, workspaceSlug, projectSlug, taskNumber });

  return task;
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
}): Promise<Task> {
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

  const updatedTask = await tasksRepository.update({ projectId: project.id, taskNumber, data, completedAt });

  return updatedTask;
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
}): Promise<Task> {
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

  const movedTask = await tasksRepository.move({
    projectId: project.id,
    task,
    status: data.status,
    afterTaskId: data.afterTaskId,
    completedAt,
  });

  // El ancla dejo de ser valida entre la validacion y la transaccion (otro usuario la archivo o la
  // movio de columna). Se rechaza en vez de colocar la tarea en un sitio arbitrario.
  if (!movedTask) {
    throw new NotFoundError("Anchor task not found");
  }

  return movedTask;
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

  await tasksRepository.archive({ projectId: project.id, taskNumber });
}
