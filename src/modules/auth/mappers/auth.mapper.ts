import type { AuthResponseDto, UserResponseDto } from "../dtos/auth.dto.ts";
import type { User } from "../../../shared/types/prisma.types.ts";
import { buildPublicUrl } from "../../../shared/storage/storage.service.ts";

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
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    email: user.email,
    id: user.id,
    // La key se guarda en BD, la URL pública se construye al vuelo a partir de S3_PUBLIC_URL_BASE
    avatarUrl: user.avatarKey ? buildPublicUrl({ key: user.avatarKey }) : null,
    isActive: user.isActive,
    emailVerifiedAt: user.emailVerifiedAt,
    lastLoginAt: user.lastLoginAt,
    timezone: user.timezone,
    locale: user.locale,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
