import { prisma } from "../../config/prisma.ts";
import type { Prisma } from "../../prisma/generated/prisma/client.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { UsersQueryDto } from "./schemas/users.schema.ts";
import type { User } from "../../shared/types/prisma.types.ts";

export async function findAll({
  query,
  excludeUserId,
  excludeWorkspaceId,
}: {
  query: UsersQueryDto;
  excludeUserId: string;
  excludeWorkspaceId?: string;
}): Promise<PaginatedResult<User>> {
  const where: Prisma.UserWhereInput = {};

  where.isActive = true;
  where.id = { not: excludeUserId };

  if (excludeWorkspaceId) {
    where.workspaceMembers = {
      none: {
        workspaceId: excludeWorkspaceId,
      },
    };
  }

  if (query.search) {
    where.OR = [
      {
        name: {
          contains: query.search,
          mode: "insensitive",
        },
      },
      {
        email: {
          contains: query.search,
          mode: "insensitive",
        },
      },
    ];
  }

  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: query.limit,
    }),

    prisma.user.count({
      where,
    }),
  ]);

  return {
    items,
    total,
  };
}
