import { ForbiddenError } from "../../shared/errors/forbidden-error.ts";
import { NotFoundError } from "../../shared/errors/not-found-error.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { CreateWorkspaceMemberDto, WorkspaceMembersQueryDto } from "./schemas/workspace-members.schema.ts";
import * as workspaceMembersRepository from "./workspace-members.repository.ts";
import { WorkspaceRole, type WorkspaceMember } from "./types/workspace-members.types.ts";
import { BadRequestError } from "../../shared/errors/bad-request-error.ts";

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

export async function create({
  data,
  userId,
  workspaceSlug,
}: {
  data: CreateWorkspaceMemberDto;
  userId: string;
  workspaceSlug: string;
}): Promise<WorkspaceMember> {
  // Comprobar si existe el workspace
  const workspace = await workspaceMembersRepository.findWorkspaceBySlug(workspaceSlug);

  if (!workspace) throw new NotFoundError("Workspace not found");

  // Revisar si es miembro del workspace
  const workspaceId = workspace.id;

  const workspaceMember = await workspaceMembersRepository.findWorkspaceMember({ userId, workspaceId });

  if (!workspaceMember) throw new ForbiddenError("You are not a member of this workspace");

  // Comprobar si tiene permisos
  if (workspaceMember.role !== WorkspaceRole.OWNER && workspaceMember.role !== WorkspaceRole.ADMIN) {
    throw new ForbiddenError("You have not permissions to manage this workspace");
  }

  if (workspaceMember.role === WorkspaceRole.ADMIN && data.role === WorkspaceRole.OWNER) {
    throw new ForbiddenError("Admins cannot assign the owner role");
  }

  // Comprobar si existe el usuario a añadir existe o esta activo
  const userActive = await workspaceMembersRepository.findUserActive(data.userId);

  if (!userActive) throw new NotFoundError("User not found");

  if (!userActive.isActive) throw new BadRequestError("Cannot add an inactive user");

  // Comprobar que no sea ya miembro
  const existingMember = await workspaceMembersRepository.findWorkspaceMember({
    userId: data.userId,
    workspaceId,
  });

  if (existingMember) {
    throw new BadRequestError("User is already a member of this workspace");
  }

  const newWorkspaceMember = await workspaceMembersRepository.create({ data, workspaceId });

  return newWorkspaceMember;
}
