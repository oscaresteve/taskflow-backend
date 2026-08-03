import type { Request, Response, NextFunction } from "express";
import * as workspaceMembersService from "./workspace-members.service.ts";
import type { WorkspaceMembersQueryDto, WorkspaceParamsDto } from "./schemas/workspace-members.schema.ts";
import { toPaginatedWorkspaceMemberResponseDto } from "./mappers/workspace-members.mapper.ts";

export async function findAll(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const query = req.validated.query as WorkspaceMembersQueryDto;
    const params = req.validated.params as WorkspaceParamsDto;
    const workspaceSlug = params.workspaceSlug;

    const workspaceMembers = await workspaceMembersService.findAll({ query, userId, workspaceSlug });

    const workspaceMemberResponse = toPaginatedWorkspaceMemberResponseDto({
      workspaceMembers,
      page: query.page,
      limit: query.limit,
    });

    res.json(workspaceMemberResponse);
  } catch (error) {
    next(error);
  }
}
