import {
  ProjectRole,
  WorkspaceRole,
  type Comment,
  type ProjectMember,
  type WorkspaceMember,
} from "../types/prisma.types.ts";
import { ForbiddenError } from "../errors/forbidden-error.ts";

export function isWorkspaceManager(workspaceMember: WorkspaceMember): boolean {
  // OWNER o ADMIN pueden administrar el workspace
  return workspaceMember.role === WorkspaceRole.OWNER || workspaceMember.role === WorkspaceRole.ADMIN;
}

export function requireWorkspaceManager(workspaceMember: WorkspaceMember): void {
  if (!isWorkspaceManager(workspaceMember)) {
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

export function isProjectManager(projectMember: ProjectMember): boolean {
  // OWNER o ADMIN pueden administrar el proyecto
  return projectMember.role === ProjectRole.OWNER || projectMember.role === ProjectRole.ADMIN;
}

export function requireProjectManager(projectMember: ProjectMember): void {
  if (!isProjectManager(projectMember)) {
    throw new ForbiddenError("You have not permissions to manage this project");
  }
}

// Un proyecto lo administra quien manda en el proyecto o quien manda en el espacio que lo contiene,
// asi que un OWNER del espacio puede editarlo sin haberse añadido nunca a el. Una pertenencia
// desactivada no da mando, pero el rol del espacio sigue valiendo.
export function requireWorkspaceOrProjectManager({
  workspaceMember,
  projectMember,
}: {
  workspaceMember: WorkspaceMember;
  projectMember: ProjectMember | null;
}): void {
  if (isWorkspaceManager(workspaceMember)) return;
  if (projectMember?.isActive && isProjectManager(projectMember)) return;

  throw new ForbiddenError("You have not permissions to manage this project");
}

export function requireCanManageProjectMember({
  actor,
  target,
}: {
  actor: ProjectMember;
  target: ProjectMember;
}): void {
  if (actor.role === ProjectRole.ADMIN && target.role === ProjectRole.OWNER) {
    throw new ForbiddenError("Admins cannot manage owners");
  }
}

export function requireCanAssignProjectRole({ actor, role }: { actor: ProjectMember; role: ProjectRole }) {
  // ADMIN no puede asignar el rol OWNER
  if (actor.role === ProjectRole.ADMIN && role === ProjectRole.OWNER) {
    throw new ForbiddenError("Admins cannot assign the owner role");
  }
}

export function requireCanManageComment({
  actor,
  comment,
  userId,
}: {
  actor: ProjectMember;
  comment: Comment;
  userId: string;
}) {
  if (comment.authorId === userId) return;

  requireProjectManager(actor);
}
