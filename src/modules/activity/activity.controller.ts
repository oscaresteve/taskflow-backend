import type { NextFunction, Request, Response } from "express";
import type { ProjectParamsDto, TaskParamsDto, WorkspaceParamsDto } from "../../shared/schemas/common.schema.ts";
import type { ActivityQueryDto } from "./schemas/activity.schema.ts";
import * as activityService from "./activity.service.ts";
import { toPaginatedActivityEventResponseDto } from "./mappers/activity.mapper.ts";

export async function findAllByWorkspace(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const params = req.validated.params as WorkspaceParamsDto;
    const workspaceSlug = params.workspaceSlug;
    const query = req.validated.query as ActivityQueryDto;

    const events = await activityService.findAllByWorkspace({ userId, workspaceSlug, query });

    const activityResponse = toPaginatedActivityEventResponseDto({ events, page: query.page, limit: query.limit });

    res.json(activityResponse);
  } catch (error) {
    next(error);
  }
}

export async function findAllByProject(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const params = req.validated.params as ProjectParamsDto;
    const workspaceSlug = params.workspaceSlug;
    const projectSlug = params.projectSlug;
    const query = req.validated.query as ActivityQueryDto;

    const events = await activityService.findAllByProject({ userId, workspaceSlug, projectSlug, query });

    const activityResponse = toPaginatedActivityEventResponseDto({ events, page: query.page, limit: query.limit });

    res.json(activityResponse);
  } catch (error) {
    next(error);
  }
}

export async function findAllByTask(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const params = req.validated.params as TaskParamsDto;
    const workspaceSlug = params.workspaceSlug;
    const projectSlug = params.projectSlug;
    const taskNumber = params.taskNumber;
    const query = req.validated.query as ActivityQueryDto;

    const events = await activityService.findAllByTask({ userId, workspaceSlug, projectSlug, taskNumber, query });

    const activityResponse = toPaginatedActivityEventResponseDto({ events, page: query.page, limit: query.limit });

    res.json(activityResponse);
  } catch (error) {
    next(error);
  }
}
