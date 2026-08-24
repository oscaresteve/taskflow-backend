import { z } from "zod";
import { limitSchema, pageSchema, searchSchema, slugSchema } from "../../../shared/schemas/common.schema.ts";

export const usersQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,

  search: searchSchema,

  // Al buscar usuarios para añadir a un workspace, excluye a quien ya tenga una fila de
  // membresia en el (cualquier status: ACTIVE, PENDING o REMOVED).
  workspaceSlug: slugSchema.optional(),
});

export type UsersQueryDto = z.infer<typeof usersQuerySchema>;
