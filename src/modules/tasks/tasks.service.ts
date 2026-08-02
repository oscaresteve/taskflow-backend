import type { CreateTaskDto, TaskQueryDto, UpdateTaskDto } from "./schemas/tasks.schema.ts";
import { ProjectRole, type Task } from "./types/tasks.types.ts";
import * as tasksRepository from "./tasks.repository.ts";
import { NotFoundError } from "../../shared/errors/not-found-error.ts";
import { ForbiddenError } from "../../shared/errors/forbidden-error.ts";
import { BadRequestError } from "../../shared/errors/bad-request-error.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";

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
  // Comprobar si existe el workspace
  const workspace = await tasksRepository.findWorkspaceBySlug(workspaceSlug);

  if (!workspace) throw new NotFoundError("Workspace not found");

  // Revisar si es miembro del workspace
  const workspaceId = workspace.id;

  const workspaceMember = await tasksRepository.findWorkspaceMember({ userId, workspaceId });

  if (!workspaceMember) throw new ForbiddenError("You are not a member of this workspace");

  const project = await tasksRepository.findBySlug({ workspaceId, slug: projectSlug });

  if (!project) throw new NotFoundError("Project not found");

  const projectId = project.id;

  // Comprobar que es miembro del proyecto
  const projectMember = await tasksRepository.findProjectMember({
    userId,
    projectId,
  });

  if (!projectMember) {
    throw new ForbiddenError("You are not a member of this project");
  }

  // Combrobar que el usuario asignado es miembro
  if (data.assigneeId) {
    const assigneeProjectMember = await tasksRepository.findProjectMember({
      userId: data.assigneeId,
      projectId,
    });

    if (!assigneeProjectMember) throw new BadRequestError("Assignee must be a member of the project");
  }

  // Calcular la posicion (Podria moverse dentro de la transation para mas consistencia)
  const position = await tasksRepository.getNextTaskPosition(projectId);

  const task = await tasksRepository.create({ data, userId, projectId, position });

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
  // Comprobar si existe el workspace
  const workspace = await tasksRepository.findWorkspaceBySlug(workspaceSlug);

  if (!workspace) throw new NotFoundError("Workspace not found");

  // Revisar si es miembro del workspace
  const workspaceId = workspace.id;

  const workspaceMember = await tasksRepository.findWorkspaceMember({ userId, workspaceId });

  if (!workspaceMember) throw new ForbiddenError("You are not a member of this workspace");

  // Comprobar si existe el proyecto
  const project = await tasksRepository.findBySlug({ workspaceId, slug: projectSlug });

  if (!project) throw new NotFoundError("Project not found");

  const projectId = project.id;

  // Comprobar que es miembro del proyecto
  const projectMember = await tasksRepository.findProjectMember({
    userId,
    projectId,
  });

  if (!projectMember) {
    throw new ForbiddenError("You are not a member of this project");
  }

  const tasks = await tasksRepository.findAll({ projectId, query });

  return tasks;
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
  // Comprobar si existe el workspace
  const workspace = await tasksRepository.findWorkspaceBySlug(workspaceSlug);

  if (!workspace) throw new NotFoundError("Workspace not found");

  // Revisar si es miembro del workspace
  const workspaceId = workspace.id;

  const workspaceMember = await tasksRepository.findWorkspaceMember({ userId, workspaceId });

  if (!workspaceMember) throw new ForbiddenError("You are not a member of this workspace");

  // Comprobar si existe el proyecto
  const project = await tasksRepository.findBySlug({ workspaceId, slug: projectSlug });

  if (!project) throw new NotFoundError("Project not found");

  const projectId = project.id;

  // Comprobar que es miembro del proyecto
  const projectMember = await tasksRepository.findProjectMember({
    userId,
    projectId,
  });

  if (!projectMember) {
    throw new ForbiddenError("You are not a member of this project");
  }

  const task = await tasksRepository.findByTaskNumber({ projectId, taskNumber });

  if (!task) throw new NotFoundError("Task not found");

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
  // Comprobar si existe el workspace
  const workspace = await tasksRepository.findWorkspaceBySlug(workspaceSlug);

  if (!workspace) throw new NotFoundError("Workspace not found");

  // Revisar si es miembro del workspace
  const workspaceId = workspace.id;

  const workspaceMember = await tasksRepository.findWorkspaceMember({ userId, workspaceId });

  if (!workspaceMember) throw new ForbiddenError("You are not a member of this workspace");

  const project = await tasksRepository.findBySlug({ workspaceId, slug: projectSlug });

  if (!project) throw new NotFoundError("Project not found");

  const projectId = project.id;

  // Comprobar que es miembro del proyecto
  const projectMember = await tasksRepository.findProjectMember({
    userId,
    projectId,
  });

  if (!projectMember) {
    throw new ForbiddenError("You are not a member of this project");
  }

  // Comprobar que existe la tarea
  const task = await tasksRepository.findByTaskNumber({ projectId, taskNumber });

  if (!task) throw new NotFoundError("Task not found");

  // Comprobar que no este archivada
  if (task.isArchived) {
    throw new BadRequestError("Archived tasks cannot be updated");
  }

  // Combrobar que el usuario asignado es miembro, solo si cambia
  if (data.assigneeId && data.assigneeId !== task.assigneeId) {
    const assigneeProjectMember = await tasksRepository.findProjectMember({
      userId: data.assigneeId,
      projectId,
    });

    if (!assigneeProjectMember) throw new BadRequestError("Assignee must be a member of the project");
  }

  // Marcar fecha de completado
  let completedAt = task.completedAt;

  if (data.status === "DONE" && task.status !== "DONE") {
    completedAt = new Date();
  }

  if (data.status && data.status !== "DONE") {
    completedAt = null;
  }

  const updatedTask = await tasksRepository.update({ projectId, taskNumber, data, completedAt });

  return updatedTask;
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
  // Comprobar si existe el workspace
  const workspace = await tasksRepository.findWorkspaceBySlug(workspaceSlug);

  if (!workspace) throw new NotFoundError("Workspace not found");

  // Revisar si es miembro del workspace
  const workspaceId = workspace.id;

  const workspaceMember = await tasksRepository.findWorkspaceMember({ userId, workspaceId });

  if (!workspaceMember) throw new ForbiddenError("You are not a member of this workspace");

  // Comprobar si existe el proyecto
  const project = await tasksRepository.findBySlug({ workspaceId, slug: projectSlug });

  if (!project) throw new NotFoundError("Project not found");

  const projectId = project.id;

  // Comprobar que es miembro del proyecto
  const projectMember = await tasksRepository.findProjectMember({
    userId,
    projectId,
  });

  if (!projectMember) {
    throw new ForbiddenError("You are not a member of this project");
  }

  // Comprobar que tiene permisos de proyecto
  if (projectMember.role !== ProjectRole.OWNER && projectMember.role !== ProjectRole.ADMIN) {
    throw new ForbiddenError("You have not permissions to manage this project");
  }

  // Comprobar que existe la tarea
  const task = await tasksRepository.findByTaskNumber({ projectId, taskNumber });

  if (!task) throw new NotFoundError("Task not found");

  // Comprobar que no este archivada
  if (task.isArchived) {
    throw new BadRequestError("Task is already archived");
  }

  await tasksRepository.archive({ projectId, taskNumber });
}
