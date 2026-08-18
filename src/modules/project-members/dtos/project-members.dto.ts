import type { ProjectRole } from "../../../shared/types/prisma.types.ts";
import type { UserResponseDto } from "../../auth/dtos/auth.dto.ts";

export type ProjectMemberResponseDto = {
  id: string;

  projectId: string;
  userId: string;

  role: ProjectRole;

  joinedAt: Date | null;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
};

export type ProjectMemberWithUserResponseDto = ProjectMemberResponseDto & {
  user: UserResponseDto;
};
