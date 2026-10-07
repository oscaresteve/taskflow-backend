import type { PaginatedResponseDto } from "../../../shared/dtos/pagination.dto.ts";
import type { PaginatedResult } from "../../../shared/types/pagination.types.ts";
import type { ProjectResponseDto } from "../dtos/projects.dto.ts";
import type { ProjectForViewer } from "../types/projects.types.ts";

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

export function toProjectResponseDtoList(projects: ProjectForViewer[]) {
  return projects.map(toProjectResponseDto);
}

export function toPaginatedProjectResponseDto({
  projects,
  page,
  limit,
}: {
  projects: PaginatedResult<ProjectForViewer>;
  page: number;
  limit: number;
}): PaginatedResponseDto<ProjectResponseDto> {
  return {
    data: toProjectResponseDtoList(projects.items),

    pagination: {
      page,
      limit,
      total: projects.total,
      pages: Math.ceil(projects.total / limit),
    },
  };
}
