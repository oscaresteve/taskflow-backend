import { prisma } from "../../config/prisma.ts";
import type { Prisma } from "../../prisma/generated/prisma/client.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { Comment } from "../../shared/types/prisma.types.ts";
import type { CommentQueryDto, CreateCommentDto, UpdateCommentDto } from "./schemas/comments.schema.ts";
import * as activityRepository from "../activity/activity.repository.ts";
import type { ActivityEventInput } from "../activity/types/activity.types.ts";

export async function create({
  taskId,
  authorId,
  data,
  activity,
}: {
  taskId: string;
  authorId: string;
  data: CreateCommentDto;
  activity: {
    workspaceId: string;
    projectId: string;
    taskNumber: number;
    taskTitle: string;
    mentions: string[];
  };
}): Promise<Comment> {
  return prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: {
        taskId,
        authorId,
        content: data.content,
      },
    });

    // El evento se arma aqui porque el id del comentario nace dentro de la transaccion, igual que
    // pasa con el taskNumber al crear una tarea.
    await activityRepository.record(tx, [
      {
        workspaceId: activity.workspaceId,
        projectId: activity.projectId,
        taskId,
        actorId: authorId,
        action: "COMMENT_CREATED",
        payload: {
          taskNumber: activity.taskNumber,
          taskTitle: activity.taskTitle,
          commentId: comment.id,
          mentions: activity.mentions,
        },
      },
    ]);

    return comment;
  });
}

export async function findAll({
  taskId,
  query,
}: {
  taskId: string;
  query: CommentQueryDto;
}): Promise<PaginatedResult<Comment>> {
  const where: Prisma.CommentWhereInput = {};

  where.taskId = taskId;
  where.deletedAt = null; // Excluir comentarios eliminados

  if (query.search) {
    where.content = {
      contains: query.search,
      mode: "insensitive",
    };
  }

  if (query.authorId) {
    where.authorId = query.authorId;
  }

  // Construimos la ordenacion
  const orderBy: Prisma.CommentOrderByWithRelationInput = {
    [query.sort]: query.order,
  };

  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      orderBy,
      skip,
      take: query.limit,
    }),

    prisma.comment.count({
      where,
    }),
  ]);

  return {
    items,
    total,
  };
}

export async function update({
  commentId,
  data,
  events,
}: {
  commentId: string;
  data: UpdateCommentDto;
  events: ActivityEventInput[];
}): Promise<Comment> {
  return prisma.$transaction(async (tx) => {
    const comment = await tx.comment.update({
      where: {
        id: commentId,
      },
      data: {
        content: data.content,
        editedAt: new Date(),
      },
    });

    await activityRepository.record(tx, events);

    return comment;
  });
}

export async function remove({
  commentId,
  events,
}: {
  commentId: string;
  events: ActivityEventInput[];
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.comment.update({
      where: {
        id: commentId,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    await activityRepository.record(tx, events);
  });
}
