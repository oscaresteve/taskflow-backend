import type { ProjectRole } from "../../../shared/types/prisma.types.ts";

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
