import { type NextFunction, type Request, type Response } from "express";
import * as authService from "./auth.service.ts";
import { toAuthResponseDto, toUserResponseDto } from "./mappers/auth.mapper.ts";

export async function signUp(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.signUp(req.body);

    const authResponse = toAuthResponseDto(result);
    res.status(201).json(authResponse);
  } catch (error) {
    next(error);
  }
}

export async function signIn(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.signIn(req.body);

    const authResponse = toAuthResponseDto(result);
    res.status(200).json(authResponse);
  } catch (error) {
    next(error);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const userResponse = toUserResponseDto(req.user);
    res.json(userResponse);
  } catch (error) {
    next(error);
  }
}
