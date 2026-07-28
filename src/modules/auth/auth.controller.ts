import { type NextFunction, type Request, type Response } from "express";
import * as authService from "./auth.service.ts";
import { toAuthResponseDto } from "./mappers/auth.mapper.ts";

export async function signUp(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.signUp(req.body);

    const authResponse = toAuthResponseDto(result);
    res.status(201).json(authResponse);
  } catch (error) {
    next(error);
  }
}
