import { type NextFunction, type Request, type Response } from "express";
import * as searchService from "./search.service.ts";
import { toSearchResponseDto } from "./mappers/search.mapper.ts";
import type { SearchQueryDto } from "./schemas/search.schema.ts";

// Llamar al servicio y mappear la respuesta.
// Responder HTTP
// Pasar errores al error handler

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.validated.query as SearchQueryDto;
    const userId = req.user.id;

    const results = await searchService.search({ userId, query });

    res.json(toSearchResponseDto(results));
  } catch (error) {
    next(error);
  }
}
