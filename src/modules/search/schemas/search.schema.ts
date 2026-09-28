import z from "zod";
import { limitSchema } from "../../../shared/schemas/common.schema.ts";

// A diferencia de los listados, aqui `search` no es opcional.
// `limit` se usa para workspace, project y task por separado, no para el total de resultados
export const searchQuerySchema = z.object({
  search: z.string().trim().min(1),
  limit: limitSchema,
});

export type SearchQueryDto = z.infer<typeof searchQuerySchema>;
