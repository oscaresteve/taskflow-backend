import type { PaginatedResponseDto } from "../../../shared/dtos/pagination.dto.ts";
import type { PaginatedResult } from "../../../shared/types/pagination.types.ts";
import type { WorkspaceListItemResponseDto, WorkspaceResponseDto } from "../dtos/workspaces.dto.ts";
import type { WorkspaceForViewer, WorkspaceListItem } from "../types/workspaces.types.ts";
import { toUserSummaryResponseDto } from "../../users/mappers/users.mapper.ts";
import { buildPublicUrl } from "../../../shared/storage/storage.service.ts";

export function toWorkspaceResponseDto(workspace: WorkspaceForViewer): WorkspaceResponseDto {
  return {
    id: workspace.id,

    name: workspace.name,
    slug: workspace.slug,

    description: workspace.description,
    // La key se guarda en BD, la URL pública se construye al vuelo a partir de S3_PUBLIC_URL_BASE
    avatarUrl: workspace.avatarKey ? buildPublicUrl({ key: workspace.avatarKey }) : null,

    isActive: workspace.isActive,
    isFavorite: workspace.isFavorite,

    myRole: workspace.myRole,

    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}

export function toWorkspaceListItemResponseDto(workspace: WorkspaceListItem): WorkspaceListItemResponseDto {
  return {
    ...toWorkspaceResponseDto(workspace),
    owners: workspace.owners.map(toUserSummaryResponseDto),
  };
}

export function toPaginatedWorkspaceResponseDto({
  workspaces,
  page,
  limit,
}: {
  workspaces: PaginatedResult<WorkspaceListItem>;
  page: number;
  limit: number;
}): PaginatedResponseDto<WorkspaceListItemResponseDto> {
  return {
    data: workspaces.items.map(toWorkspaceListItemResponseDto),

    pagination: {
      page,
      limit,
      total: workspaces.total,
      pages: Math.ceil(workspaces.total / limit),
    },
  };
}
