import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type {
  CreateProjectMemberDto,
  ProjectMembersQueryDto,
  UpdateProjectMemberDto,
} from "./schemas/project-members.schema.ts";
import * as projectMembersRepository from "./project-members.repository.ts";
import * as authorizationService from "../../shared/auth/authorization.service.ts";
import {
  requireCanAssignProjectRole,
  requireCanManageProjectMember,
  requireProjectManager,
} from "../../shared/auth/permissions.ts";
import { WorkspaceMemberStatus, type ProjectMember } from "../../shared/types/prisma.types.ts";
import { BadRequestError } from "../../shared/errors/bad-request-error.ts";

export async function findAll({
  query,
  userId,
  workspaceSlug,
  projectSlug,
}: {
  query: ProjectMembersQueryDto;
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
}): Promise<PaginatedResult<ProjectMember>> {
  // Obtener contexto
  const { project } = await authorizationService.getProjectContext({ userId, workspaceSlug, projectSlug });

  const projectMembers = await projectMembersRepository.findAll({ projectId: project.id, query });

  return projectMembers;
}

export async function create({
  data,
  userId,
  workspaceSlug,
  projectSlug,
}: {
  data: CreateProjectMemberDto;
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
}): Promise<ProjectMember> {
  // Obtener contexto
  const { project, projectMember } = await authorizationService.getProjectContext({
    userId,
    workspaceSlug,
    projectSlug,
  });

  // Comprobar permisos
  requireProjectManager(projectMember);

  requireCanAssignProjectRole({
    actor: projectMember,
    role: data.role,
  });

  // Comprobar que el objetivo es miembro del workspace
  const { workspaceMemberTarget } = await authorizationService.getWorkspaceMemberTarget({
    workspaceId: project.workspaceId,
    workspaceMemberUserId: data.userId,
  });

  // Comprobar que el objetivo esta activo
  if (workspaceMemberTarget.status !== WorkspaceMemberStatus.ACTIVE) {
    throw new BadRequestError("User must be an active workspace member");
  }

  // Comprobar que no es ya miembro del proyecto
  const existingProjectMember = await projectMembersRepository.findProjectMember({
    projectId: project.id,
    userId: data.userId,
  });

  if (existingProjectMember) {
    throw new BadRequestError("User is already a member of this project");
  }

  const newProjectMember = await projectMembersRepository.create({ data, projectId: project.id });

  return newProjectMember;
}

export async function update({
  data,
  userId,
  workspaceSlug,
  projectSlug,
  projectMemberUserId,
}: {
  data: UpdateProjectMemberDto;
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
  projectMemberUserId: string;
}): Promise<ProjectMember> {
  // Obtener contexto
  const { project, projectMember } = await authorizationService.getProjectContext({
    userId,
    workspaceSlug,
    projectSlug,
  });

  // Comprobar permisos
  requireProjectManager(projectMember);

  // Obtener el miembro objetivo
  const { projectMemberTarget } = await authorizationService.getProjectMemberTarget({
    projectId: project.id,
    projectMemberUserId,
  });

  if (projectMemberUserId === userId) {
    throw new BadRequestError("You cannot change your own role");
  }

  // No modificar inactivos
  if (!projectMemberTarget.isActive) {
    throw new BadRequestError("Inactive members cannot be updated");
  }

  // ADMIN no puede administrar un OWNER
  requireCanManageProjectMember({
    actor: projectMember,
    target: projectMemberTarget,
  });

  // ADMIN no puede asignar el rol OWNER
  requireCanAssignProjectRole({
    actor: projectMember,
    role: data.role,
  });

  // Evitar actualización innecesaria
  if (projectMemberTarget.role === data.role) {
    throw new BadRequestError("Project member already has this role");
  }

  const newProjectMember = await projectMembersRepository.update({
    data,
    userId: projectMemberUserId,
    projectId: project.id,
  });

  return newProjectMember;
}

export async function deactivate({
  userId,
  workspaceSlug,
  projectSlug,
  projectMemberUserId,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
  projectMemberUserId: string;
}): Promise<void> {
  // Obtener contexto
  const { project, projectMember } = await authorizationService.getProjectContext({
    userId,
    workspaceSlug,
    projectSlug,
  });

  // Comprobar permisos
  requireProjectManager(projectMember);

  // Obtener el miembro objetivo
  const { projectMemberTarget } = await authorizationService.getProjectMemberTarget({
    projectId: project.id,
    projectMemberUserId,
  });

  if (projectMemberUserId === userId) {
    throw new BadRequestError("You cannot deactivate yourself");
  }

  // ADMIN no puede administrar un OWNER
  requireCanManageProjectMember({
    actor: projectMember,
    target: projectMemberTarget,
  });

  // No modificar inactivos
  if (!projectMemberTarget.isActive) {
    throw new BadRequestError("Project member is already inactive");
  }

  await projectMembersRepository.deactivate({
    userId: projectMemberUserId,
    projectId: project.id,
  });
}
