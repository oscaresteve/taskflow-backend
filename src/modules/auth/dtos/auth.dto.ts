export type { SignUpDto } from "../schemas/auth.schema.ts";

export interface UserResponseDto {
  firstName: string;
  lastName: string;
  email: string;
  id: string;
  avatarUrl: string | null;
  isActive: boolean;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  timezone: string | null;
  locale: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponseDto {
  user: UserResponseDto;
}
