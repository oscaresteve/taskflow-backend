export type { SignUpDto } from "../schemas/auth.schema.ts";

export interface UserResponseDto {
  name: string;
  email: string;
  id: string;
  avatarUrl: string | null;
  isActive: boolean;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponseDto {
  user: UserResponseDto;
}
