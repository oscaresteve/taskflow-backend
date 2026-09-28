import z from "zod";
import { limitSchema, pageSchema, searchSchema } from "../../../shared/schemas/common.schema.ts";

// Las rejillas del overview (proyectos de un espacio, espacios del usuario) paginan y buscan; el
// orden es fijo por nombre, asi que no se expone.
export const overviewGridQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  search: searchSchema,
});

export type OverviewGridQueryDto = z.infer<typeof overviewGridQuerySchema>;
