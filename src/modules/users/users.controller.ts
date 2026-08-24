import type { Request, Response, NextFunction } from "express";
import type { UsersQueryDto } from "./schemas/users.schema.ts";
import * as usersService from "./users.service.ts";
import { toPaginatedUserResponseDto } from "./mappers/users.mapper.ts";

export async function findAll(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const query = req.validated.query as UsersQueryDto;

    const users = await usersService.findAll({ query, userId });

    const usersResponse = toPaginatedUserResponseDto({
      users,
      page: query.page,
      limit: query.limit,
    });

    res.json(usersResponse);
  } catch (error) {
    next(error);
  }
}
