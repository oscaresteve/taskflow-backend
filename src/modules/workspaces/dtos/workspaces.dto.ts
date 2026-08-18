import type { ProjectResponseDto } from "../../projects/dtos/projects.dto.ts";
import type { WorkspaceMemberWithUserResponseDto } from "../../workspace-members/dtos/workspace-members.dto.ts";

export type WorkspaceResponseDto = {
  id: string;

  name: string;
  slug: string;

  description: string | null;
  logoUrl: string | null;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
};

export type WorkspaceDetailResponseDto = WorkspaceResponseDto & {
  projects: ProjectResponseDto[];
  members: WorkspaceMemberWithUserResponseDto[];
};
