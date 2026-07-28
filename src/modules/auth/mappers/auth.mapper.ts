import type { AuthResponseDto } from "../dtos/auth.dto.ts";
import type { User } from "../types/auth.types.ts";

interface ToAuthResponseDtoInput {
  user: User;
  accessToken: string;
}

export function toAuthResponseDto({ user, accessToken }: ToAuthResponseDtoInput): AuthResponseDto {
  return {
    user: {
      name: user.name,
      email: user.email,
      id: user.id,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    accessToken,
  };
}
