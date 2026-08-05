import type { PaginatedResponseDto } from "../../../shared/dtos/pagination.dto.ts";
import type { PaginatedResult } from "../../../shared/types/pagination.types.ts";
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

export function toCommentResponseDtoList(comments: Comment[]): CommentResponseDto[] {
  return comments.map(toCommentResponse);
}

export function toPaginatedCommentResponseDto({
  comments,
  page,
  limit,
}: {
  comments: PaginatedResult<Comment>;
  page: number;
  limit: number;
}): PaginatedResponseDto<CommentResponseDto> {
  return {
    data: toCommentResponseDtoList(comments.items),

    pagination: {
      page,
      limit,
      total: comments.total,
      pages: Math.ceil(comments.total / limit),
    },
  };
}
