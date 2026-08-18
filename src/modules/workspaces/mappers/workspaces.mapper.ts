import type { PaginatedResponseDto } from "../../../shared/dtos/pagination.dto.ts";
import type { PaginatedResult } from "../../../shared/types/pagination.types.ts";
import type { WorkspaceDetailResponseDto, WorkspaceResponseDto } from "../dtos/workspaces.dto.ts";
import type { Project, User, Workspace, WorkspaceMember } from "../../../shared/types/prisma.types.ts";
import { toProjectResponseDtoList } from "../../projects/mappers/projects.mapper.ts";
import { toWorkspaceMemberWithUserResponseDtoList } from "../../workspace-members/mappers/workspace-members.mapper.ts";

export function toWorkspaceResponseDto(workspace: Workspace): WorkspaceResponseDto {
  return {
    id: workspace.id,

    name: workspace.name,
    slug: workspace.slug,

    description: workspace.description,
    logoUrl: workspace.logoUrl,

    isActive: workspace.isActive,

    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}

export function toWorkspaceDetailResponseDto({
  workspace,
  projects,
  members,
}: {
  workspace: Workspace;
  projects: Project[];
  members: (WorkspaceMember & { user: User })[];
}): WorkspaceDetailResponseDto {
  return {
    ...toWorkspaceResponseDto(workspace),
    projects: toProjectResponseDtoList(projects),
    members: toWorkspaceMemberWithUserResponseDtoList(members),
  };
}

export function toWorkspaceResponseDtoList(workspaces: Workspace[]) {
  return workspaces.map(toWorkspaceResponseDto);
}

export function toPaginatedWorkspaceResponseDto({
  workspaces,
  page,
  limit,
}: {
  workspaces: PaginatedResult<Workspace>;
  page: number;
  limit: number;
}): PaginatedResponseDto<WorkspaceResponseDto> {
  return {
    data: toWorkspaceResponseDtoList(workspaces.items),

    pagination: {
      page,
      limit,
      total: workspaces.total,
      pages: Math.ceil(workspaces.total / limit),
    },
  };
}
