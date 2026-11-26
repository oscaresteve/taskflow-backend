import * as searchRepository from "./search.repository.ts";
import type { SearchQueryDto } from "./schemas/search.schema.ts";

// LLamar al repository y realizar toda la lógica necesaria

export async function search({ userId, query }: { userId: string; query: SearchQueryDto }) {
  return searchRepository.search({ userId, search: query.search, limit: query.limit });
}
