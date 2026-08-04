import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { ProjectMembersQueryDto } from "./schemas/project-members.schema.ts";
import type { ProjectMember } from "./types/project-members.types.ts";
import * as projectMembersRepository from "./project-members.repository.ts";
import * as authorizationService from "../../shared/auth/authorization.service.ts";

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
