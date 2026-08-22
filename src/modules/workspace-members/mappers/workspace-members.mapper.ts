import type { PaginatedResponseDto } from "../../../shared/dtos/pagination.dto.ts";
import type { PaginatedResult } from "../../../shared/types/pagination.types.ts";
import type { WorkspaceMemberResponseDto, WorkspaceMemberWithUserResponseDto } from "../dtos/workspace-members.dto.ts";
import type { User, WorkspaceMember } from "../../../shared/types/prisma.types.ts";
import { toUserResponseDto } from "../../auth/mappers/auth.mapper.ts";

export function toWorkspaceMemberResponseDto(workspaceMember: WorkspaceMember): WorkspaceMemberResponseDto {
  return {
    id: workspaceMember.id,

    workspaceId: workspaceMember.workspaceId,
    userId: workspaceMember.userId,

    role: workspaceMember.role,
    status: workspaceMember.status,

    joinedAt: workspaceMember.joinedAt,

    createdAt: workspaceMember.createdAt,
    updatedAt: workspaceMember.updatedAt,
  };
}

export function toWorkspaceMemberWithUserResponseDto(
  workspaceMember: WorkspaceMember & { user: User },
): WorkspaceMemberWithUserResponseDto {
  return {
    ...toWorkspaceMemberResponseDto(workspaceMember),
    user: toUserResponseDto(workspaceMember.user),
  };
}

export function toWorkspaceMemberWithUserResponseDtoList(workspaceMembers: (WorkspaceMember & { user: User })[]) {
  return workspaceMembers.map(toWorkspaceMemberWithUserResponseDto);
}

export function toWorkspaceMemberResponseDtoList(workspaceMembers: WorkspaceMember[]) {
  return workspaceMembers.map(toWorkspaceMemberResponseDto);
}

export function toPaginatedWorkspaceMemberResponseDto({
  workspaceMembers,
  page,
  limit,
}: {
  workspaceMembers: PaginatedResult<WorkspaceMember>;
  page: number;
  limit: number;
}): PaginatedResponseDto<WorkspaceMemberResponseDto> {
  return {
    data: toWorkspaceMemberResponseDtoList(workspaceMembers.items),

    pagination: {
      page,
      limit,
      total: workspaceMembers.total,
      pages: Math.ceil(workspaceMembers.total / limit),
    },
  };
}

export function toPaginatedWorkspaceMemberWithUserResponseDto({
  workspaceMembers,
  page,
  limit,
}: {
  workspaceMembers: PaginatedResult<WorkspaceMember & { user: User }>;
  page: number;
  limit: number;
}): PaginatedResponseDto<WorkspaceMemberWithUserResponseDto> {
  return {
    data: toWorkspaceMemberWithUserResponseDtoList(workspaceMembers.items),

    pagination: {
      page,
      limit,
      total: workspaceMembers.total,
      pages: Math.ceil(workspaceMembers.total / limit),
    },
  };
}
