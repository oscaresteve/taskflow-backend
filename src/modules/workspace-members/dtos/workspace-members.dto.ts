import type { WorkspaceMemberStatus, WorkspaceRole } from "../../../shared/types/prisma.types.ts";

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
