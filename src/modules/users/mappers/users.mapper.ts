import type { PaginatedResponseDto } from "../../../shared/dtos/pagination.dto.ts";
import type { PaginatedResult } from "../../../shared/types/pagination.types.ts";
import type { UserResponseDto } from "../../auth/dtos/auth.dto.ts";
import type { User } from "../../../shared/types/prisma.types.ts";
import { toUserResponseDto } from "../../auth/mappers/auth.mapper.ts";

export function toPaginatedUserResponseDto({
  users,
  page,
  limit,
}: {
  users: PaginatedResult<User>;
  page: number;
  limit: number;
}): PaginatedResponseDto<UserResponseDto> {
  return {
    data: users.items.map(toUserResponseDto),

    pagination: {
      page,
      limit,
      total: users.total,
      pages: Math.ceil(users.total / limit),
    },
  };
}
