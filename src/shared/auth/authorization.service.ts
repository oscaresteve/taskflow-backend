import type { Workspace, WorkspaceMember } from "../../prisma/generated/prisma/client.ts";
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
