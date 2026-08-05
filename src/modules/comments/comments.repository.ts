import { prisma } from "../../config/prisma.ts";
import type { Comment } from "../../shared/types/prisma.types.ts";
import type { CreateCommentDto } from "./schemas/comments.schema.ts";

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
