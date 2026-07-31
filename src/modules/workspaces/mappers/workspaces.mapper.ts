import type { PaginatedResponseDto } from "../../../shared/dtos/pagination.dto.ts";
import type { PaginatedResult } from "../../../shared/types/pagination.types.ts";
import type { WorkspaceResponseDto } from "../dtos/workspaces.dto.ts";
import type { Workspace } from "../types/workspaces.types.ts";

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
