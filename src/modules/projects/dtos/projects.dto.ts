import type { WorkspaceResponseDto } from "../../workspaces/dtos/workspaces.dto.ts";
import type { ProjectMemberWithUserResponseDto } from "../../project-members/dtos/project-members.dto.ts";
import type { TaskResponseDto } from "../../tasks/dtos/tasks.dto.ts";

export type ProjectResponseDto = {
  id: string;

  name: string;
  slug: string;
  key: string;

  description: string | null;
  icon: string | null;
  color: string | null;

  isArchived: boolean;

  createdAt: Date;
  updatedAt: Date;
};

export type ProjectDetailResponseDto = ProjectResponseDto & {
  workspace: WorkspaceResponseDto;
  members: ProjectMemberWithUserResponseDto[];
  tasks: TaskResponseDto[];
};
