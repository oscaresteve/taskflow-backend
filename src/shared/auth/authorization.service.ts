import { WorkspaceMemberStatus } from "../types/prisma.types.ts";
import type { Project, ProjectMember, Task, Workspace, WorkspaceMember, Comment } from "../types/prisma.types.ts";
import * as authorizationRepository from "../../shared/auth/authorization.repository.ts";
import { ForbiddenError } from "../errors/forbidden-error.ts";
import { NotFoundError } from "../errors/not-found-error.ts";

// La pertenencia al espacio la resuelven los dos cargadores (el estricto y el que admite espacios
// desactivados), y la regla tiene que ser la misma en ambos: vive aqui una sola vez para que no
// pueda divergir.
async function requireActiveWorkspaceMember({
  userId,
  workspaceId,
}: {
  userId: string;
  workspaceId: string;
}): Promise<WorkspaceMember> {
  // El usuario es miembro
  const workspaceMember = await authorizationRepository.findWorkspaceMember({ userId, workspaceId });
  if (!workspaceMember) throw new ForbiddenError("You are not a member of this workspace");

  // Los miembros pendientes o eliminados no tienen acceso al workspace
  if (workspaceMember.status !== WorkspaceMemberStatus.ACTIVE) {
    throw new ForbiddenError("You are not an active member of this workspace");
  }

  return workspaceMember;
}

export async function getWorkspaceContext({
  userId,
  workspaceSlug,
}: {
  userId: string;
  workspaceSlug: string;
}): Promise<{
  workspace: Workspace;
  workspaceMember: WorkspaceMember;
}> {
  // Workspace existe
  const workspace = await authorizationRepository.findWorkspaceBySlug(workspaceSlug);
  if (!workspace) throw new NotFoundError("Workspace not found");

  const workspaceMember = await requireActiveWorkspaceMember({ userId, workspaceId: workspace.id });

  return {
    workspace,
    workspaceMember,
  };
}

// Hermana de getWorkspaceContext para la unica accion que tiene sentido sobre un espacio muerto:
// reactivarlo. Sigue exigiendo pertenencia ACTIVE, que la desactivacion no toca a los miembros.
// Ningun otro cargador la usa: todo lo que cuelga de un espacio inactivo debe seguir dando 404.
export async function getWorkspaceContextIncludingInactive({
  userId,
  workspaceSlug,
}: {
  userId: string;
  workspaceSlug: string;
}): Promise<{
  workspace: Workspace;
  workspaceMember: WorkspaceMember;
}> {
  const workspace = await authorizationRepository.findWorkspaceBySlugIncludingInactive(workspaceSlug);
  if (!workspace) throw new NotFoundError("Workspace not found");

  const workspaceMember = await requireActiveWorkspaceMember({ userId, workspaceId: workspace.id });

  return {
    workspace,
    workspaceMember,
  };
}

export async function getWorkspaceMemberTarget({
  workspaceId,
  workspaceMemberUserId,
}: {
  workspaceId: string;
  workspaceMemberUserId: string;
}): Promise<{ workspaceMemberTarget: WorkspaceMember }> {
  // El usuario objetivo es miembro
  const workspaceMemberTarget = await authorizationRepository.findWorkspaceMember({
    workspaceId,
    userId: workspaceMemberUserId,
  });

  if (!workspaceMemberTarget) {
    throw new NotFoundError("Workspace member not found");
  }

  return {
    workspaceMemberTarget,
  };
}

// Igual que getProjectContext pero sin exigir pertenencia al proyecto: `projectMember` viene null si
// el usuario no esta en el proyecto. Lo usan las acciones que tambien puede hacer quien manda en el
// espacio, que por eso no pueden dejar que el cargador lance antes de mirar el rol.
export async function getProjectContextAllowingWorkspaceManager({
  userId,
  workspaceSlug,
  projectSlug,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
}): Promise<{
  workspace: Workspace;
  workspaceMember: WorkspaceMember;
  project: Project;
  // Puede venir desactivado: quien decide si eso da mando es requireWorkspaceOrProjectManager.
  projectMember: ProjectMember | null;
}> {
  const { workspace, workspaceMember } = await getWorkspaceContext({ userId, workspaceSlug });

  // Proyecto existe
  const project = await authorizationRepository.findProjectBySlug({ workspaceId: workspace.id, slug: projectSlug });
  if (!project) throw new NotFoundError("Project not found");

  const projectMember = await authorizationRepository.findProjectMember({ userId, projectId: project.id });

  return {
    workspace,
    workspaceMember,
    project,
    projectMember,
  };
}

// Hermana de getProjectContextAllowingWorkspaceManager para desarchivar. Resuelve el espacio con el
// cargador estricto a proposito: un proyecto de un espacio inactivo sigue dando 404, asi que el
// orden es siempre reactivar el espacio y luego desarchivar el proyecto.
export async function getProjectContextIncludingArchivedAllowingWorkspaceManager({
  userId,
  workspaceSlug,
  projectSlug,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
}): Promise<{
  workspace: Workspace;
  workspaceMember: WorkspaceMember;
  project: Project;
  projectMember: ProjectMember | null;
}> {
  const { workspace, workspaceMember } = await getWorkspaceContext({ userId, workspaceSlug });

  const project = await authorizationRepository.findProjectBySlugIncludingArchived({
    workspaceId: workspace.id,
    slug: projectSlug,
  });
  if (!project) throw new NotFoundError("Project not found");

  const projectMember = await authorizationRepository.findProjectMember({ userId, projectId: project.id });

  return {
    workspace,
    workspaceMember,
    project,
    projectMember,
  };
}

export async function getProjectContext({
  userId,
  workspaceSlug,
  projectSlug,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
}): Promise<{
  workspace: Workspace;
  workspaceMember: WorkspaceMember;
  project: Project;
  projectMember: ProjectMember;
}> {
  const { workspace, workspaceMember, project, projectMember } = await getProjectContextAllowingWorkspaceManager({
    userId,
    workspaceSlug,
    projectSlug,
  });

  // El usuario es miembro
  if (!projectMember) {
    throw new ForbiddenError("You are not a member of this project");
  }

  // Los miembros desactivados no tienen acceso al proyecto
  if (!projectMember.isActive) {
    throw new ForbiddenError("You are not an active member of this project");
  }

  return {
    workspace,
    workspaceMember,
    project,
    projectMember,
  };
}

export async function getProjectMemberTarget({
  projectId,
  projectMemberUserId,
}: {
  projectId: string;
  projectMemberUserId: string;
}): Promise<{ projectMemberTarget: ProjectMember }> {
  const projectMemberTarget = await authorizationRepository.findProjectMember({
    projectId,
    userId: projectMemberUserId,
  });

  if (!projectMemberTarget) {
    throw new NotFoundError("Project member not found");
  }

  return {
    projectMemberTarget,
  };
}

export async function getTaskContext({
  userId,
  workspaceSlug,
  projectSlug,
  taskNumber,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
  taskNumber: number;
}): Promise<{
  workspace: Workspace;
  workspaceMember: WorkspaceMember;
  project: Project;
  projectMember: ProjectMember;
  task: Task;
}> {
  // Workspace existe
  const workspace = await authorizationRepository.findWorkspaceBySlug(workspaceSlug);
  if (!workspace) throw new NotFoundError("Workspace not found");

  // El usuario es miembro
  const workspaceMember = await authorizationRepository.findWorkspaceMember({ userId, workspaceId: workspace.id });
  if (!workspaceMember) throw new ForbiddenError("You are not a member of this workspace");

  // Los miembros pendientes o eliminados no tienen acceso al workspace
  if (workspaceMember.status !== WorkspaceMemberStatus.ACTIVE) {
    throw new ForbiddenError("You are not an active member of this workspace");
  }

  // Proyecto existe
  const project = await authorizationRepository.findProjectBySlug({ workspaceId: workspace.id, slug: projectSlug });
  if (!project) throw new NotFoundError("Project not found");

  // El usuario es miembro
  const projectMember = await authorizationRepository.findProjectMember({ userId, projectId: project.id });
  if (!projectMember) {
    throw new ForbiddenError("You are not a member of this project");
  }

  // Los miembros desactivados no tienen acceso al proyecto
  if (!projectMember.isActive) {
    throw new ForbiddenError("You are not an active member of this project");
  }

  // La tarea existe
  const task = await authorizationRepository.findTaskByNumber({ projectId: project.id, taskNumber });

  if (!task) throw new NotFoundError("Task not found");

  return {
    workspace,
    workspaceMember,
    project,
    projectMember,
    task,
  };
}

export async function getCommentContext({
  userId,
  workspaceSlug,
  projectSlug,
  taskNumber,
  commentId,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
  taskNumber: number;
  commentId: string;
}): Promise<{
  workspace: Workspace;
  workspaceMember: WorkspaceMember;
  project: Project;
  projectMember: ProjectMember;
  task: Task;
  comment: Comment;
}> {
  // Workspace existe
  const workspace = await authorizationRepository.findWorkspaceBySlug(workspaceSlug);
  if (!workspace) throw new NotFoundError("Workspace not found");

  // El usuario es miembro
  const workspaceMember = await authorizationRepository.findWorkspaceMember({ userId, workspaceId: workspace.id });
  if (!workspaceMember) throw new ForbiddenError("You are not a member of this workspace");

  // Los miembros pendientes o eliminados no tienen acceso al workspace
  if (workspaceMember.status !== WorkspaceMemberStatus.ACTIVE) {
    throw new ForbiddenError("You are not an active member of this workspace");
  }

  // Proyecto existe
  const project = await authorizationRepository.findProjectBySlug({ workspaceId: workspace.id, slug: projectSlug });
  if (!project) throw new NotFoundError("Project not found");

  // El usuario es miembro
  const projectMember = await authorizationRepository.findProjectMember({ userId, projectId: project.id });
  if (!projectMember) {
    throw new ForbiddenError("You are not a member of this project");
  }

  // Los miembros desactivados no tienen acceso al proyecto
  if (!projectMember.isActive) {
    throw new ForbiddenError("You are not an active member of this project");
  }

  // La tarea existe
  const task = await authorizationRepository.findTaskByNumber({ projectId: project.id, taskNumber });

  if (!task) throw new NotFoundError("Task not found");

  // El comentario existe y pertenece a la tarea del path
  const comment = await authorizationRepository.findComment(commentId);

  if (!comment || comment.taskId !== task.id) throw new NotFoundError("Comment not found");

  return {
    workspace,
    workspaceMember,
    project,
    projectMember,
    task,
    comment,
  };
}
