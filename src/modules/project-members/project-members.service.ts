import { ForbiddenError } from "../../shared/errors/forbidden-error.ts";
import { NotFoundError } from "../../shared/errors/not-found-error.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { ProjectMembersQueryDto } from "./schemas/project-members.schema.ts";
import type { ProjectMember } from "./types/project-members.types.ts";
import * as projectMembersRepository from "./project-members.repository.ts";

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
  // Comprobar si existe el workspace
  const workspace = await projectMembersRepository.findWorkspaceBySlug(workspaceSlug);

  if (!workspace) throw new NotFoundError("Workspace not found");

  // Revisar si es miembro del workspace
  const workspaceId = workspace.id;

  const workspaceMember = await projectMembersRepository.findWorkspaceMember({ userId, workspaceId });

  if (!workspaceMember) throw new ForbiddenError("You are not a member of this workspace");

  // Comprobar si existe el proyecto
  const project = await projectMembersRepository.findProjectBySlug({ workspaceId, slug: projectSlug });

  if (!project) throw new NotFoundError("Project not found");

  const projectId = project.id;

  // Comprobar que es miembro del proyecto
  const projectMember = await projectMembersRepository.findProjectMember({
    userId,
    projectId,
  });

  if (!projectMember) {
    throw new ForbiddenError("You are not a member of this project");
  }

  const projectMembers = await projectMembersRepository.findAll({ projectId, query });

  return projectMembers;
}
