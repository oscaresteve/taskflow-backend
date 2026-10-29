import type { PaginatedResponseDto } from "../../../shared/dtos/pagination.dto.ts";
import type { PaginatedResult } from "../../../shared/types/pagination.types.ts";
import type { ProjectListItemResponseDto, ProjectResponseDto } from "../dtos/projects.dto.ts";
import type { ProjectForViewer, ProjectListItem } from "../types/projects.types.ts";
import { toUserSummaryResponseDto } from "../../users/mappers/users.mapper.ts";

export function toProjectResponseDto(project: ProjectForViewer): ProjectResponseDto {
  return {
    id: project.id,

    name: project.name,
    slug: project.slug,
    key: project.key,

    description: project.description,
    color: project.color,

    isArchived: project.isArchived,
    isFavorite: project.isFavorite,

    myRole: project.myRole,

    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export function toProjectListItemResponseDto(project: ProjectListItem): ProjectListItemResponseDto {
  return {
    ...toProjectResponseDto(project),
    owners: project.owners.map(toUserSummaryResponseDto),
  };
}

export function toPaginatedProjectResponseDto({
  projects,
  page,
  limit,
}: {
  projects: PaginatedResult<ProjectListItem>;
  page: number;
  limit: number;
}): PaginatedResponseDto<ProjectListItemResponseDto> {
  return {
    data: projects.items.map(toProjectListItemResponseDto),

    pagination: {
      page,
      limit,
      total: projects.total,
      pages: Math.ceil(projects.total / limit),
    },
  };
}
