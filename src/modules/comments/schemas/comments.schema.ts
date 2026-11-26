import z from "zod";
import { limitSchema, pageSchema, searchSchema, sortOrderSchema } from "../../../shared/schemas/common.schema.ts";

export const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

const sortableFields = ["createdAt", "updatedAt"] as const;

export const commentQuerySchema = z.object({
  // Pagination
  page: pageSchema,
  limit: limitSchema,

  // Filters
  authorId: z.cuid().optional(),
  search: searchSchema,

  // Sorting
  sort: z.enum(sortableFields).default("createdAt"),
  order: sortOrderSchema,
});

export const updateCommentSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

export type CreateCommentDto = z.infer<typeof createCommentSchema>;
export type CommentQueryDto = z.infer<typeof commentQuerySchema>;
export type UpdateCommentDto = z.infer<typeof updateCommentSchema>;
