import { ForbiddenError } from "../../shared/errors/forbidden-error.ts";
import { NotFoundError } from "../../shared/errors/not-found-error.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { WorkspaceMembersQueryDto } from "./schemas/workspace-members.schema.ts";
import * as workspaceMembersRepository from "./workspace-members.repository.ts";
import type { WorkspaceMember } from "./types/workspace-members.types.ts";

export async function findAll({
  query,
  userId,
  workspaceSlug,
}: {
  query: WorkspaceMembersQueryDto;
  userId: string;
  workspaceSlug: string;
}): Promise<PaginatedResult<WorkspaceMember>> {
  // Comprobar si existe el workspace
  const workspace = await workspaceMembersRepository.findWorkspaceBySlug(workspaceSlug);

  if (!workspace) throw new NotFoundError("Workspace not found");

  // Revisar si es miembro del workspace
  const workspaceId = workspace.id;

  const workspaceMember = await workspaceMembersRepository.findWorkspaceMember({ userId, workspaceId });

  if (!workspaceMember) throw new ForbiddenError("You are not a member of this workspace");

  const workspaceMembers = await workspaceMembersRepository.findAll({ workspaceId, query });

  return workspaceMembers;
}
