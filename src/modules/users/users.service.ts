import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { UsersQueryDto } from "./schemas/users.schema.ts";
import * as usersRepository from "./users.repository.ts";
import * as authorizationService from "../../shared/auth/authorization.service.ts";
import type { User } from "../../shared/types/prisma.types.ts";

export async function findAll({ query, userId }: { query: UsersQueryDto; userId: string }): Promise<PaginatedResult<User>> {
  let excludeWorkspaceId: string | undefined;

  if (query.workspaceSlug) {
    // Tambien confirma que el propio usuario es miembro activo del workspace.
    const { workspace } = await authorizationService.getWorkspaceContext({
      userId,
      workspaceSlug: query.workspaceSlug,
    });
    excludeWorkspaceId = workspace.id;
  }

  const users = await usersRepository.findAll({ query, excludeUserId: userId, excludeWorkspaceId });

  return users;
}
