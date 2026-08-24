import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { UsersQueryDto } from "./schemas/users.schema.ts";
import * as usersRepository from "./users.repository.ts";
import type { User } from "../../shared/types/prisma.types.ts";

export async function findAll({ query, userId }: { query: UsersQueryDto; userId: string }): Promise<PaginatedResult<User>> {
  const users = await usersRepository.findAll({ query, excludeUserId: userId });

  return users;
}
