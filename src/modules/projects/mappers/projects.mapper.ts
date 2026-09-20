import type { PaginatedResponseDto } from "../../../shared/dtos/pagination.dto.ts";
import type { PaginatedResult } from "../../../shared/types/pagination.types.ts";
import type { ProjectResponseDto } from "../dtos/projects.dto.ts";
import type { Project } from "../../../shared/types/prisma.types.ts";

export function toProjectResponseDto(project: Project & { isFavorite: boolean }): ProjectResponseDto {
  return {
    id: project.id,

    name: project.name,
    slug: project.slug,
    key: project.key,

    description: project.description,
    icon: project.icon,
    color: project.color,

    isArchived: project.isArchived,
    isFavorite: project.isFavorite,

    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export function toProjectResponseDtoList(projects: (Project & { isFavorite: boolean })[]) {
  return projects.map(toProjectResponseDto);
}

export function toPaginatedProjectResponseDto({
  projects,
  page,
  limit,
}: {
  projects: PaginatedResult<Project & { isFavorite: boolean }>;
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
