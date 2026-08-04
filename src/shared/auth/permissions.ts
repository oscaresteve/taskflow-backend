import { WorkspaceRole, type WorkspaceMember } from "../../prisma/generated/prisma/client.ts";
import { ForbiddenError } from "../errors/forbidden-error.ts";

export function requireWorkspaceManager(workspaceMember: WorkspaceMember): void {
  // OWNER o ADMIN pueden administrar el workspace
  if (workspaceMember.role !== WorkspaceRole.OWNER && workspaceMember.role !== WorkspaceRole.ADMIN) {
    throw new ForbiddenError("You have not permissions to manage this workspace");
  }
}

export function requireCanManageWorkspaceMember({
  actor,
  target,
}: {
  actor: WorkspaceMember;
  target: WorkspaceMember;
}) {
  // ADMIN no puede administrar un OWNER
  if (actor.role === WorkspaceRole.ADMIN && target.role === WorkspaceRole.OWNER) {
    throw new ForbiddenError("Admins cannot manage owners");
  }
}

export function requireCanAssignWorkspaceRole({ actor, role }: { actor: WorkspaceMember; role: WorkspaceRole }) {
  // ADMIN no puede asignar el rol OWNER
  if (actor.role === WorkspaceRole.ADMIN && role === WorkspaceRole.OWNER) {
    throw new ForbiddenError("Admins cannot assign the owner role");
  }
}
