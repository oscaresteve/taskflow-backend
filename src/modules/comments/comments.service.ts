import type { CommentQueryDto, CreateCommentDto, UpdateCommentDto } from "./schemas/comments.schema.ts";
import type { Comment } from "../../shared/types/prisma.types.ts";
import * as authorizationService from "../../shared/auth/authorization.service.ts";
import * as commentsRepository from "./comments.repository.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import { requireCanManageComment } from "../../shared/auth/permissions.ts";
import { ConflictError } from "../../shared/errors/conflict-error.ts";
import { ForbiddenError } from "../../shared/errors/forbidden-error.ts";

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

export async function update({
  userId,
  workspaceSlug,
  projectSlug,
  taskNumber,
  commentId,
  data,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
  taskNumber: number;
  commentId: string;
  data: UpdateCommentDto;
}): Promise<Comment> {
  const { comment } = await authorizationService.getCommentContext({
    userId,
    workspaceSlug,
    projectSlug,
    taskNumber,
    commentId,
  });

  if (comment.authorId !== userId) throw new ForbiddenError("You cannot manage others comments");

  const newComment = await commentsRepository.update({ data, commentId });

  return newComment;
}

export async function remove({
  userId,
  workspaceSlug,
  projectSlug,
  taskNumber,
  commentId,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
  taskNumber: number;
  commentId: string;
}): Promise<void> {
  const { projectMember, comment } = await authorizationService.getCommentContext({
    userId,
    workspaceSlug,
    projectSlug,
    taskNumber,
    commentId,
  });

  requireCanManageComment({ actor: projectMember, comment, userId });

  if (comment.deletedAt) throw new ConflictError("Comment is already deleted");

  await commentsRepository.remove(commentId);
}
