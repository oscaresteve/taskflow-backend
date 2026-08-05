import { prisma } from "../../config/prisma.ts";
import type { Prisma } from "../../prisma/generated/prisma/client.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { Comment } from "../../shared/types/prisma.types.ts";
import type { CommentQueryDto, CreateCommentDto } from "./schemas/comments.schema.ts";

export async function create({
  taskId,
  authorId,
  data,
}: {
  taskId: string;
  authorId: string;
  data: CreateCommentDto;
}): Promise<Comment> {
  return prisma.comment.create({
    data: {
      taskId,
      authorId,
      content: data.content,
    },
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
