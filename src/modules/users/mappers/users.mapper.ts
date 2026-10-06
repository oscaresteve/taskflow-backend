import type { PaginatedResponseDto } from "../../../shared/dtos/pagination.dto.ts";
import type { PaginatedResult } from "../../../shared/types/pagination.types.ts";
import type { UserProfileResponseDto, UserSummaryResponseDto } from "../dtos/users.dto.ts";
import type { UserProfileRow, UserSummaryRow } from "../users.repository.ts";

export function toUserSummaryResponseDto(user: UserSummaryRow): UserSummaryResponseDto {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    email: user.email,
  };
}

export function toUserProfileResponseDto(user: UserProfileRow): UserProfileResponseDto {
  return {
    ...toUserSummaryResponseDto(user),
    isActive: user.isActive,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export function toPaginatedUserSummaryResponseDto({
  users,
  page,
  limit,
}: {
  users: PaginatedResult<UserSummaryRow>;
  page: number;
  limit: number;
}): PaginatedResponseDto<UserSummaryResponseDto> {
  return {
    data: users.items.map(toUserSummaryResponseDto),

    pagination: {
      page,
      limit,
      total: users.total,
      pages: Math.ceil(users.total / limit),
    },
  };
}
