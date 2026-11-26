import z from "zod";
import {
  booleanQueryParamSchema,
  limitSchema,
  pageSchema,
  searchSchema,
} from "../../../shared/schemas/common.schema.ts";

// Las rejillas del overview (proyectos de un espacio, espacios del usuario) paginan, buscan y
// acotan a favoritos; el orden es fijo por nombre, asi que no se expone.
export const overviewGridQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  search: searchSchema,
  isFavorite: booleanQueryParamSchema,
});

export type OverviewGridQueryDto = z.infer<typeof overviewGridQuerySchema>;
