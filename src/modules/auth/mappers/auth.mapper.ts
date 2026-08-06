import type { AuthResponseDto, UserResponseDto } from "../dtos/auth.dto.ts";
import type { User } from "../../../shared/types/prisma.types.ts";

interface ToAuthResponseDtoInput {
  user: User;
}

export function toAuthResponseDto({ user }: ToAuthResponseDtoInput): AuthResponseDto {
  return {
    user: toUserResponseDto(user),
  };
}

export function toUserResponseDto(user: User): UserResponseDto {
  return {
    name: user.name,
    email: user.email,
    id: user.id,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    emailVerifiedAt: user.emailVerifiedAt,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
