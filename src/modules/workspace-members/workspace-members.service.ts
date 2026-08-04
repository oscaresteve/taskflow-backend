import { NotFoundError } from "../../shared/errors/not-found-error.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type {
  CreateWorkspaceMemberDto,
  UpdateWorkspaceMemberDto,
  WorkspaceMembersQueryDto,
} from "./schemas/workspace-members.schema.ts";
import * as workspaceMembersRepository from "./workspace-members.repository.ts";
import { WorkspaceMemberStatus, type WorkspaceMember } from "./types/workspace-members.types.ts";
import { BadRequestError } from "../../shared/errors/bad-request-error.ts";
import * as authorizationService from "../../shared/auth/authorization.service.ts";
import {
  requireCanAssignWorkspaceRole,
  requireCanManageWorkspaceMember,
  requireWorkspaceManager,
} from "../../shared/auth/permissions.ts";

export async function findAll({
  query,
  userId,
  workspaceSlug,
}: {
  query: WorkspaceMembersQueryDto;
  userId: string;
  workspaceSlug: string;
}): Promise<PaginatedResult<WorkspaceMember>> {
  // Obtener contexto
  const { workspace } = await authorizationService.getWorkspaceContext({ userId, workspaceSlug });

  const workspaceMembers = await workspaceMembersRepository.findAll({ workspaceId: workspace.id, query });

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
  // Obtener contexto
  const { workspace, workspaceMember } = await authorizationService.getWorkspaceContext({ userId, workspaceSlug });

  // Comprobar permisos
  requireWorkspaceManager(workspaceMember);

  requireCanAssignWorkspaceRole({
    actor: workspaceMember,
    role: data.role,
  });

  // Comprobar si existe el usuario a añadir existe o esta activo
  const userActive = await workspaceMembersRepository.findUserActive(data.userId);

  if (!userActive) throw new NotFoundError("User not found");

  if (!userActive.isActive) throw new BadRequestError("Cannot add an inactive user");

  // Comprobar que no sea ya miembro
  const existingMember = await workspaceMembersRepository.findWorkspaceMember({
    userId: data.userId,
    workspaceId: workspace.id,
  });

  if (existingMember) {
    throw new BadRequestError("User is already a member of this workspace");
  }

  const newWorkspaceMember = await workspaceMembersRepository.create({ data, workspaceId: workspace.id });

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
  // Obtener contexto
  const { workspace, workspaceMember } = await authorizationService.getWorkspaceContext({ userId, workspaceSlug });

  // Comprobar permisos
  requireWorkspaceManager(workspaceMember);

  // Obtener miembro objetivo
  const { workspaceMemberTarget } = await authorizationService.getWorkspaceMemberTarget({
    workspaceId: workspace.id,
    workspaceMemberUserId,
  });

  // ADMIN no puede administrar un OWNER
  requireCanManageWorkspaceMember({
    actor: workspaceMember,
    target: workspaceMemberTarget,
  });

  if (workspaceMemberTarget.status === WorkspaceMemberStatus.REMOVED) {
    throw new BadRequestError("Removed members cannot be activated");
  }

  if (workspaceMemberTarget.status === WorkspaceMemberStatus.ACTIVE) {
    throw new BadRequestError("Workspace member is already active");
  }

  await workspaceMembersRepository.activate({
    workspaceId: workspace.id,
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
  // Obtener contexto
  const { workspace, workspaceMember } = await authorizationService.getWorkspaceContext({ userId, workspaceSlug });

  // Comprobar permisos
  requireWorkspaceManager(workspaceMember);

  // Obtener miembro objetivo
  const { workspaceMemberTarget } = await authorizationService.getWorkspaceMemberTarget({
    workspaceId: workspace.id,
    workspaceMemberUserId,
  });

  if (workspaceMemberUserId === userId) {
    throw new BadRequestError("You cannot change your own role");
  }

  // No modificar eliminados
  if (workspaceMemberTarget.status === WorkspaceMemberStatus.REMOVED) {
    throw new BadRequestError("Removed members cannot be updated");
  }

  // ADMIN no puede administrar un OWNER
  requireCanManageWorkspaceMember({
    actor: workspaceMember,
    target: workspaceMemberTarget,
  });

  // ADMIN no puede asignar el rol OWNER
  requireCanAssignWorkspaceRole({
    actor: workspaceMember,
    role: data.role,
  });

  // Evitar actualización innecesari
  if (workspaceMemberTarget.role === data.role) {
    throw new BadRequestError("Workspace member already has this role");
  }

  await workspaceMembersRepository.update({
    workspaceId: workspace.id,
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
  // Obtener contexto
  const { workspace, workspaceMember } = await authorizationService.getWorkspaceContext({ userId, workspaceSlug });

  // Comprobar permisos
  requireWorkspaceManager(workspaceMember);

  // Obtener miembro objetivo
  const { workspaceMemberTarget } = await authorizationService.getWorkspaceMemberTarget({
    workspaceId: workspace.id,
    workspaceMemberUserId,
  });

  // No permitir eliminar un miembro ya eliminado
  if (workspaceMemberTarget.status === WorkspaceMemberStatus.REMOVED) {
    throw new BadRequestError("Workspace member is already removed");
  }

  // ADMIN no puede administrar un OWNER
  requireCanManageWorkspaceMember({
    actor: workspaceMember,
    target: workspaceMemberTarget,
  });

  // No permitir eliminarse a sí mismo
  if (workspaceMemberUserId === userId) {
    throw new BadRequestError("You cannot remove yourself from the workspace");
  }

  await workspaceMembersRepository.remove({
    workspaceId: workspace.id,
    userId: workspaceMemberUserId,
  });
}
