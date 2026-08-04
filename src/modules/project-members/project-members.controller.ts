import type { Request, Response, NextFunction } from "express";
import type {
  CreateProjectMemberDto,
  ProjectMembersQueryDto,
  ProjectParamsDto,
} from "./schemas/project-members.schema.ts";
import * as projectMembersService from "./project-members.service.ts";
import { toPaginatedProjectMemberResponseDto, toProjectMemberResponseDto } from "./mappers/project-members.mapper.ts";

export async function findAll(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const query = req.validated.query as ProjectMembersQueryDto;
    const params = req.validated.params as ProjectParamsDto;
    const workspaceSlug = params.workspaceSlug;
    const projectSlug = params.projectSlug;

    const projectMembers = await projectMembersService.findAll({ query, userId, workspaceSlug, projectSlug });

    const projectMemberResponse = toPaginatedProjectMemberResponseDto({
      projectMembers,
      page: query.page,
      limit: query.limit,
    });

    res.json(projectMemberResponse);
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const data = req.validated.query as CreateProjectMemberDto;
    const params = req.validated.params as ProjectParamsDto;
    const workspaceSlug = params.workspaceSlug;
    const projectSlug = params.projectSlug;

    const projectMember = await projectMembersService.create({ data, userId, workspaceSlug, projectSlug });

    const projectMemberResponse = toProjectMemberResponseDto(projectMember);

    res.json(projectMemberResponse);
  } catch (error) {
    next(error);
  }
}
