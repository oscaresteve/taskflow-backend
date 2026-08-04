import type { Project, ProjectMember, Task, Workspace, WorkspaceMember } from "../../prisma/generated/prisma/client.ts";
import * as authorizationRepository from "../../shared/auth/authorization.repository.ts";
import { ForbiddenError } from "../errors/forbidden-error.ts";
import { NotFoundError } from "../errors/not-found-error.ts";

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

  // El usuario es miembro
  const workspaceMember = await authorizationRepository.findWorkspaceMember({ userId, workspaceId: workspace.id });
  if (!workspaceMember) throw new ForbiddenError("You are not a member of this workspace");

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
  // Workspace existe
  const workspace = await authorizationRepository.findWorkspaceBySlug(workspaceSlug);
  if (!workspace) throw new NotFoundError("Workspace not found");

  // El usuario es miembro
  const workspaceMember = await authorizationRepository.findWorkspaceMember({ userId, workspaceId: workspace.id });
  if (!workspaceMember) throw new ForbiddenError("You are not a member of this workspace");

  // Proyecto existe
  const project = await authorizationRepository.findProjectBySlug({ workspaceId: workspace.id, slug: projectSlug });
  if (!project) throw new NotFoundError("Project not found");

  // El usuario es miembro
  const projectMember = await authorizationRepository.findProjectMember({ userId, projectId: project.id });
  if (!projectMember) {
    throw new ForbiddenError("You are not a member of this project");
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

  // Proyecto existe
  const project = await authorizationRepository.findProjectBySlug({ workspaceId: workspace.id, slug: projectSlug });
  if (!project) throw new NotFoundError("Project not found");

  // El usuario es miembro
  const projectMember = await authorizationRepository.findProjectMember({ userId, projectId: project.id });
  if (!projectMember) {
    throw new ForbiddenError("You are not a member of this project");
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
