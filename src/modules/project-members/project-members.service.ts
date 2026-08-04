import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { CreateProjectMemberDto, ProjectMembersQueryDto } from "./schemas/project-members.schema.ts";
import type { ProjectMember } from "./types/project-members.types.ts";
import * as projectMembersRepository from "./project-members.repository.ts";
import * as authorizationService from "../../shared/auth/authorization.service.ts";
import { requireCanAssignProjectRole, requireProjectManager } from "../../shared/auth/permissions.ts";
import { WorkspaceMemberStatus } from "../workspaces/types/workspaces.types.ts";
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
