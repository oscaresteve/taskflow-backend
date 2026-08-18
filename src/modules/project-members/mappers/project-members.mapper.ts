import type { PaginatedResponseDto } from "../../../shared/dtos/pagination.dto.ts";
import type { PaginatedResult } from "../../../shared/types/pagination.types.ts";
import type { ProjectMemberResponseDto, ProjectMemberWithUserResponseDto } from "../dtos/project-members.dto.ts";
import type { ProjectMember, User } from "../../../shared/types/prisma.types.ts";
import { toUserResponseDto } from "../../auth/mappers/auth.mapper.ts";

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

export function toProjectMemberWithUserResponseDto(
  projectMember: ProjectMember & { user: User },
): ProjectMemberWithUserResponseDto {
  return {
    ...toProjectMemberResponseDto(projectMember),
    user: toUserResponseDto(projectMember.user),
  };
}

export function toProjectMemberWithUserResponseDtoList(projectMembers: (ProjectMember & { user: User })[]) {
  return projectMembers.map(toProjectMemberWithUserResponseDto);
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
