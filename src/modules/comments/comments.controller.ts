import type { NextFunction, Request, Response } from "express";
import type { TaskParamsDto } from "../../shared/schemas/common.schema.ts";
import type { CommentQueryDto, CreateCommentDto } from "./schemas/comments.schema.ts";
import * as commentsService from "./comments.service.ts";
import { toCommentResponse, toPaginatedCommentResponseDto } from "./mappers/comments.mapper.ts";

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const params = req.validated.params as TaskParamsDto;
    const workspaceSlug = params.workspaceSlug;
    const projectSlug = params.projectSlug;
    const taskNumber = params.taskNumber;
    const data = req.validated.body as CreateCommentDto;

    const comment = await commentsService.create({ userId, workspaceSlug, projectSlug, taskNumber, data });

    const commentResponse = toCommentResponse(comment);

    res.status(201).json(commentResponse);
  } catch (error) {
    next(error);
  }
}

export async function findAll(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const params = req.validated.params as TaskParamsDto;
    const workspaceSlug = params.workspaceSlug;
    const projectSlug = params.projectSlug;
    const taskNumber = params.taskNumber;
    const query = req.validated.query as CommentQueryDto;

    const comments = await commentsService.findAll({ userId, workspaceSlug, projectSlug, taskNumber, query });

    const commentResponse = toPaginatedCommentResponseDto({ comments, page: query.page, limit: query.limit });

    res.json(commentResponse);
  } catch (error) {
    next(error);
  }
}
