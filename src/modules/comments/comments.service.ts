import type { CommentQueryDto, CreateCommentDto } from "./schemas/comments.schema.ts";
import type { Comment } from "../../shared/types/prisma.types.ts";
import * as authorizationService from "../../shared/auth/authorization.service.ts";
import * as commentsRepository from "./comments.repository.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";

export async function create({
  userId,
  workspaceSlug,
  projectSlug,
  taskNumber,
  data,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
  taskNumber: number;
  data: CreateCommentDto;
}): Promise<Comment> {
  const { task } = await authorizationService.getTaskContext({ userId, workspaceSlug, projectSlug, taskNumber });

  const comment = await commentsRepository.create({ data, authorId: userId, taskId: task.id });

  return comment;
}

export async function findAll({
  userId,
  workspaceSlug,
  projectSlug,
  taskNumber,
  query,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
  taskNumber: number;
  query: CommentQueryDto;
}): Promise<PaginatedResult<Comment>> {
  const { task } = await authorizationService.getTaskContext({ userId, workspaceSlug, projectSlug, taskNumber });

  const comments = await commentsRepository.findAll({ taskId: task.id, query });

  return comments;
}
