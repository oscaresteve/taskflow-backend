import type { Comment } from "../../../shared/types/prisma.types.ts";
import type { CommentResponseDto } from "../dtos/comments.dto.ts";

export function toCommentResponse(comment: Comment): CommentResponseDto {
  return {
    id: comment.id,

    taskId: comment.taskId,
    authorId: comment.authorId,

    content: comment.content,

    editedAt: comment.editedAt,
    deletedAt: comment.deletedAt,

    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}
