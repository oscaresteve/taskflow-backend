export type CommentResponseDto = {
  id: string;

  taskId: string;
  authorId: string;

  content: string;

  editedAt: Date | null;
  deletedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
};
