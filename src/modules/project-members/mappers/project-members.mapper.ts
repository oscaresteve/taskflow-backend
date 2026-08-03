import type { PaginatedResponseDto } from "../../../shared/dtos/pagination.dto.ts";
import type { PaginatedResult } from "../../../shared/types/pagination.types.ts";
import type { ProjectMemberResponseDto } from "../dtos/project-members.dto.ts";
import type { ProjectMember } from "../types/project-members.types.ts";

export function toProjectMemberResponseDto(projectMember: ProjectMember): ProjectMemberResponseDto {
  return {
    id: projectMember.id,

    projectId: projectMember.projectId,
    userId: projectMember.userId,

    role: projectMember.role,

    joinedAt: projectMember.joinedAt,

    isActive: projectMember.isActive,

    createdAt: projectMember.createdAt,
    updatedAt: projectMember.updatedAt,
  };
}

export function toProjectMemberResponseDtoList(projectMembers: ProjectMember[]) {
  return projectMembers.map(toProjectMemberResponseDto);
}

export function toPaginatedProjectMemberResponseDto({
  projectMembers,
  page,
  limit,
}: {
  projectMembers: PaginatedResult<ProjectMember>;
  page: number;
  limit: number;
}): PaginatedResponseDto<ProjectMemberResponseDto> {
  return {
    data: toProjectMemberResponseDtoList(projectMembers.items),

    pagination: {
      page,
      limit,
      total: projectMembers.total,
      pages: Math.ceil(projectMembers.total / limit),
    },
  };
}
