import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { UsersQueryDto } from "./schemas/users.schema.ts";
import * as usersRepository from "./users.repository.ts";
import type { UserProfileRow, UserSummaryRow } from "./users.repository.ts";
import * as authorizationService from "../../shared/auth/authorization.service.ts";
import { requireWorkspaceManager } from "../../shared/auth/permissions.ts";
import { NotFoundError } from "../../shared/errors/not-found-error.ts";

export async function findAll({
  query,
  userId,
}: {
  query: UsersQueryDto;
  userId: string;
}): Promise<PaginatedResult<UserSummaryRow>> {
  // Tambien confirma que el propio usuario es miembro activo del workspace.
  const { workspace, workspaceMember } = await authorizationService.getWorkspaceContext({
    userId,
    workspaceSlug: query.workspaceSlug,
  });

  // El mismo permiso que exige dar de alta a alguien: quien no puede añadir tampoco necesita la
  // lista de candidatos a los que añadir.
  requireWorkspaceManager(workspaceMember);

  const users = await usersRepository.findAll({ query, excludeUserId: userId, excludeWorkspaceId: workspace.id });

  return users;
}

export async function findOne({
  targetUserId,
  viewerId,
}: {
  targetUserId: string;
  viewerId: string;
}): Promise<UserProfileRow> {
  const user = await usersRepository.findProfileById({ targetUserId, viewerId });

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return user;
}
