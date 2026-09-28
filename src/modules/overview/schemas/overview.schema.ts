import z from "zod";
import { limitSchema, pageSchema, searchSchema } from "../../../shared/schemas/common.schema.ts";

// La rejilla de proyectos del overview pagina y busca; el orden es fijo (por nombre), asi que no
// se expone.
export const overviewProjectQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  search: searchSchema,
});

export type OverviewProjectQueryDto = z.infer<typeof overviewProjectQuerySchema>;
