import type { PaginatedResponseDto } from "../../../shared/dtos/pagination.dto.ts";
import type { PaginatedResult } from "../../../shared/types/pagination.types.ts";
import type { ProjectDetailResponseDto, ProjectResponseDto } from "../dtos/projects.dto.ts";
import type { Project, ProjectMember, Task, User, Workspace } from "../../../shared/types/prisma.types.ts";
import { toWorkspaceResponseDto } from "../../workspaces/mappers/workspaces.mapper.ts";
import { toProjectMemberWithUserResponseDtoList } from "../../project-members/mappers/project-members.mapper.ts";
import { toTaskResponseDtoList } from "../../tasks/mappers/tasks.mapper.ts";

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

export function toProjectDetailResponseDto({
  project,
  workspace,
  members,
  tasks,
}: {
  project: Project;
  workspace: Workspace;
  members: (ProjectMember & { user: User })[];
  tasks: Task[];
}): ProjectDetailResponseDto {
  return {
    ...toProjectResponseDto(project),
    workspace: toWorkspaceResponseDto(workspace),
    members: toProjectMemberWithUserResponseDtoList(members),
    tasks: toTaskResponseDtoList(tasks),
  };
}

export function toProjectResponseDtoList(projects: Project[]) {
  return projects.map(toProjectResponseDto);
}

export function toPaginatedProjectResponseDto({
  projects,
  page,
  limit,
}: {
  projects: PaginatedResult<Project>;
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
