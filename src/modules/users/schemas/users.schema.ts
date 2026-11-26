import { z } from "zod";
import { limitSchema, pageSchema, searchSchema, slugSchema } from "../../../shared/schemas/common.schema.ts";

export const usersQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,

  search: searchSchema,

  // Obligatorio: el unico alta a la que sirve este directorio es la de un workspace, asi que el
  // slug hace dos cosas. Excluye a quien ya tenga una fila de membresia en el (cualquier status:
  // ACTIVE, PENDING o REMOVED), y dice de que alta se trata, que es lo que decide quien puede
  // mirar la lista.
  workspaceSlug: slugSchema,
});

export const userParamsSchema = z.object({
  userId: z.cuid(),
});

export type UsersQueryDto = z.infer<typeof usersQuerySchema>;
export type UserParamsDto = z.infer<typeof userParamsSchema>;
