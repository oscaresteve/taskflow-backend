import type { Request, Response, NextFunction } from "express";
import type { UserParamsDto, UsersQueryDto } from "./schemas/users.schema.ts";
import * as usersService from "./users.service.ts";
import { toPaginatedUserSummaryResponseDto, toUserProfileResponseDto } from "./mappers/users.mapper.ts";

export async function findAll(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const query = req.validated.query as UsersQueryDto;

    const users = await usersService.findAll({ query, userId });

    const usersResponse = toPaginatedUserSummaryResponseDto({
      users,
      page: query.page,
      limit: query.limit,
    });

    res.json(usersResponse);
  } catch (error) {
    next(error);
  }
}

export async function findOne(req: Request, res: Response, next: NextFunction) {
  try {
    const params = req.validated.params as UserParamsDto;

    const user = await usersService.findOne({ targetUserId: params.userId, viewerId: req.user.id });

    res.json(toUserProfileResponseDto(user));
  } catch (error) {
    next(error);
  }
}
