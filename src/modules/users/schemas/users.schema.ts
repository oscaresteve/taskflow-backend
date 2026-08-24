import { z } from "zod";
import { limitSchema, pageSchema, searchSchema } from "../../../shared/schemas/common.schema.ts";

export const usersQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,

  search: searchSchema,
});

export type UsersQueryDto = z.infer<typeof usersQuerySchema>;
