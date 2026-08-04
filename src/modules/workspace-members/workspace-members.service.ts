import { ForbiddenError } from "../../shared/errors/forbidden-error.ts";
import { NotFoundError } from "../../shared/errors/not-found-error.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type {
  CreateWorkspaceMemberDto,
  UpdateWorkspaceMemberDto,
  WorkspaceMembersQueryDto,
} from "./schemas/workspace-members.schema.ts";
import * as workspaceMembersRepository from "./workspace-members.repository.ts";
import { WorkspaceMemberStatus, WorkspaceRole, type WorkspaceMember } from "./types/workspace-members.types.ts";
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

export async function activate({
  userId,
  workspaceSlug,
  workspaceMemberUserId,
}: {
  userId: string;
  workspaceSlug: string;
  workspaceMemberUserId: string;
}): Promise<void> {
  // Comprobar si existe el workspace
  const workspace = await workspaceMembersRepository.findWorkspaceBySlug(workspaceSlug);

  if (!workspace) throw new NotFoundError("Workspace not found");

  const workspaceId = workspace.id;

  // Comprobar que el actor es miembro del workspace
  const workspaceMember = await workspaceMembersRepository.findWorkspaceMember({
    userId,
    workspaceId,
  });

  if (!workspaceMember) {
    throw new ForbiddenError("You are not a member of this workspace");
  }

  // Comprobar permisos
  if (workspaceMember.role !== WorkspaceRole.OWNER && workspaceMember.role !== WorkspaceRole.ADMIN) {
    throw new ForbiddenError("You have not permissions to manage this workspace");
  }

  // Comprobar que existe el miembro a activar
  const workspaceMemberTarget = await workspaceMembersRepository.findWorkspaceMember({
    workspaceId,
    userId: workspaceMemberUserId,
  });

  if (!workspaceMemberTarget) {
    throw new NotFoundError("Workspace member not found");
  }

  // Un ADMIN no puede activar a un OWNER
  if (workspaceMember.role === WorkspaceRole.ADMIN && workspaceMemberTarget.role === WorkspaceRole.OWNER) {
    throw new ForbiddenError("Admins cannot activate owners");
  }

  // Validar estado
  if (workspaceMemberTarget.status === WorkspaceMemberStatus.REMOVED) {
    throw new BadRequestError("Removed members cannot be activated");
  }

  if (workspaceMemberTarget.status === WorkspaceMemberStatus.ACTIVE) {
    throw new BadRequestError("Workspace member is already active");
  }

  await workspaceMembersRepository.activate({
    workspaceId,
    userId: workspaceMemberUserId,
  });
}

export async function update({
  data,
  userId,
  workspaceSlug,
  workspaceMemberUserId,
}: {
  data: UpdateWorkspaceMemberDto;
  userId: string;
  workspaceSlug: string;
  workspaceMemberUserId: string;
}): Promise<void> {
  const workspace = await workspaceMembersRepository.findWorkspaceBySlug(workspaceSlug);

  if (!workspace) throw new NotFoundError("Workspace not found");

  const workspaceId = workspace.id;

  // Actor
  const workspaceMember = await workspaceMembersRepository.findWorkspaceMember({
    userId,
    workspaceId,
  });

  if (!workspaceMember) {
    throw new ForbiddenError("You are not a member of this workspace");
  }

  if (workspaceMember.role !== WorkspaceRole.OWNER && workspaceMember.role !== WorkspaceRole.ADMIN) {
    throw new ForbiddenError("You have not permissions to manage this workspace");
  }

  // Objetivo
  if (workspaceMemberUserId === userId) {
    throw new BadRequestError("You cannot change your own role");
  }

  const workspaceMemberTarget = await workspaceMembersRepository.findWorkspaceMember({
    workspaceId,
    userId: workspaceMemberUserId,
  });

  if (!workspaceMemberTarget) {
    throw new NotFoundError("Workspace member not found");
  }

  // No modificar eliminados
  if (workspaceMemberTarget.status === WorkspaceMemberStatus.REMOVED) {
    throw new BadRequestError("Removed members cannot be updated");
  }

  // ADMIN no puede modificar OWNER
  if (workspaceMember.role === WorkspaceRole.ADMIN && workspaceMemberTarget.role === WorkspaceRole.OWNER) {
    throw new ForbiddenError("Admins cannot manage owners");
  }

  // ADMIN no puede promover a OWNER
  if (workspaceMember.role === WorkspaceRole.ADMIN && data.role === WorkspaceRole.OWNER) {
    throw new ForbiddenError("Admins cannot assign the owner role");
  }

  // Evitar actualización innecesaria
  if (workspaceMemberTarget.role === data.role) {
    throw new BadRequestError("Workspace member already has this role");
  }

  await workspaceMembersRepository.update({
    workspaceId,
    userId: workspaceMemberUserId,
    role: data.role,
  });
}

export async function remove({
  userId,
  workspaceSlug,
  workspaceMemberUserId,
}: {
  userId: string;
  workspaceSlug: string;
  workspaceMemberUserId: string;
}): Promise<void> {
  // Comprobar si existe el workspace
  const workspace = await workspaceMembersRepository.findWorkspaceBySlug(workspaceSlug);

  if (!workspace) throw new NotFoundError("Workspace not found");

  const workspaceId = workspace.id;

  // Comprobar que el actor es miembro
  const workspaceMember = await workspaceMembersRepository.findWorkspaceMember({
    userId,
    workspaceId,
  });

  if (!workspaceMember) {
    throw new ForbiddenError("You are not a member of this workspace");
  }

  // Comprobar permisos
  if (workspaceMember.role !== WorkspaceRole.OWNER && workspaceMember.role !== WorkspaceRole.ADMIN) {
    throw new ForbiddenError("You have not permissions to manage this workspace");
  }

  // Comprobar que existe el miembro objetivo
  const workspaceMemberTarget = await workspaceMembersRepository.findWorkspaceMember({
    workspaceId,
    userId: workspaceMemberUserId,
  });

  if (!workspaceMemberTarget) {
    throw new NotFoundError("Workspace member not found");
  }

  // No permitir eliminar un miembro ya eliminado
  if (workspaceMemberTarget.status === WorkspaceMemberStatus.REMOVED) {
    throw new BadRequestError("Workspace member is already removed");
  }

  // Un ADMIN no puede eliminar a un OWNER
  if (workspaceMember.role === WorkspaceRole.ADMIN && workspaceMemberTarget.role === WorkspaceRole.OWNER) {
    throw new ForbiddenError("Admins cannot remove owners");
  }

  // No permitir eliminarse a sí mismo
  if (workspaceMemberUserId === userId) {
    throw new BadRequestError("You cannot remove yourself from the workspace");
  }

  await workspaceMembersRepository.remove({
    workspaceId,
    userId: workspaceMemberUserId,
  });
}
