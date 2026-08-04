import type { Request, Response, NextFunction } from "express";
import * as workspaceMembersService from "./workspace-members.service.ts";
import type {
  CreateWorkspaceMemberDto,
  WorkspaceMemberParamsDto,
  WorkspaceMembersQueryDto,
  WorkspaceParamsDto,
} from "./schemas/workspace-members.schema.ts";
import {
  toPaginatedWorkspaceMemberResponseDto,
  toWorkspaceMemberResponseDto,
} from "./mappers/workspace-members.mapper.ts";

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

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const data = req.validated.body as CreateWorkspaceMemberDto;
    const params = req.validated.params as WorkspaceParamsDto;
    const workspaceSlug = params.workspaceSlug;

    const workspaceMember = await workspaceMembersService.create({ data, userId, workspaceSlug });

    const workspaceMemberResponse = toWorkspaceMemberResponseDto(workspaceMember);

    res.status(201).json(workspaceMemberResponse);
  } catch (error) {
    next(error);
  }
}

export async function activate(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const params = req.validated.params as WorkspaceMemberParamsDto;
    const workspaceSlug = params.workspaceSlug;
    const workspaceMemberUserId = params.userId;

    await workspaceMembersService.activate({
      userId,
      workspaceSlug,
      workspaceMemberUserId,
    });

    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
}
