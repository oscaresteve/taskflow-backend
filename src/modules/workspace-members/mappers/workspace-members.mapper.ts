import type { PaginatedResponseDto } from "../../../shared/dtos/pagination.dto.ts";
import type { PaginatedResult } from "../../../shared/types/pagination.types.ts";
import type { WorkspaceMemberResponseDto } from "../dtos/workspace-members.dto.ts";
import type { WorkspaceMember } from "../../../shared/types/prisma.types.ts";

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
