import type { WorkspaceMemberStatus, WorkspaceRole } from "../../../shared/types/prisma.types.ts";
import type { UserResponseDto } from "../../auth/dtos/auth.dto.ts";

export type WorkspaceMemberResponseDto = {
  id: string;

  userId: string;
  workspaceId: string;

  role: WorkspaceRole;
  status: WorkspaceMemberStatus;

  joinedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
};

export type WorkspaceMemberWithUserResponseDto = WorkspaceMemberResponseDto & {
  user: UserResponseDto;
};
