import type { PaginatedResponseDto } from "../../../shared/dtos/pagination.dto.ts";
import type { PaginatedResult } from "../../../shared/types/pagination.types.ts";
import type { WorkspaceResponseDto } from "../dtos/workspaces.dto.ts";
import type { Workspace } from "../../../shared/types/prisma.types.ts";
import { buildPublicUrl } from "../../../shared/storage/storage.service.ts";

export function toWorkspaceResponseDto(workspace: Workspace & { isFavorite: boolean }): WorkspaceResponseDto {
  return {
    id: workspace.id,

    name: workspace.name,
    slug: workspace.slug,

    description: workspace.description,
    // La key se guarda en BD, la URL pública se construye al vuelo a partir de S3_PUBLIC_URL_BASE
    avatarUrl: workspace.avatarKey ? buildPublicUrl({ key: workspace.avatarKey }) : null,

    isActive: workspace.isActive,
    isFavorite: workspace.isFavorite,

    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}

export function toWorkspaceResponseDtoList(workspaces: (Workspace & { isFavorite: boolean })[]) {
  return workspaces.map(toWorkspaceResponseDto);
}

export function toPaginatedWorkspaceResponseDto({
  workspaces,
  page,
  limit,
}: {
  workspaces: PaginatedResult<Workspace & { isFavorite: boolean }>;
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
