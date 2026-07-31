import type { ProjectResponseDto } from "../dtos/projects.dto.ts";
import type { Project } from "../types/projects.types.ts";

export function toProjectResponseDto(project: Project): ProjectResponseDto {
  return {
    id: project.id,

    name: project.name,
    slug: project.slug,
    key: project.key,

    description: project.description,
    icon: project.icon,
    color: project.color,

    isArchived: project.isArchived,

    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export function toProjectResponseDtoList(workspaces: Project[]) {
  return workspaces.map(toProjectResponseDto);
}
