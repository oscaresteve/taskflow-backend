import type { CreateCommentDto } from "./schemas/comments.schema.ts";
import type { Comment } from "../../shared/types/prisma.types.ts";
import * as authorizationService from "../../shared/auth/authorization.service.ts";
import * as commentsRepository from "./comments.repository.ts";

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
