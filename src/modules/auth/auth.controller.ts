import { type NextFunction, type Request, type Response } from "express";
import * as authService from "./auth.service.ts";
import { toAuthResponseDto, toUserResponseDto } from "./mappers/auth.mapper.ts";
import { setAccessTokenCookie, setRefreshTokenCookie, clearAuthCookies } from "../../shared/security/cookies.ts";
import { UnauthorizedError } from "../../shared/errors/unauthorized-error.ts";
import type { UpdateMeDto } from "./schemas/auth.schema.ts";

export async function signUp(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.signUp(req.body);

    setAccessTokenCookie(res, { token: result.accessToken, expiresAt: result.accessTokenExpiresAt });
    setRefreshTokenCookie(res, { token: result.refreshToken, expiresAt: result.refreshTokenExpiresAt });

    const authResponse = toAuthResponseDto(result);
    res.status(201).json(authResponse);
  } catch (error) {
    next(error);
  }
}

export async function signIn(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.signIn(req.body);

    setAccessTokenCookie(res, { token: result.accessToken, expiresAt: result.accessTokenExpiresAt });
    setRefreshTokenCookie(res, { token: result.refreshToken, expiresAt: result.refreshTokenExpiresAt });

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

export async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const data = req.validated.body as UpdateMeDto; // TODO: Tipar req.validated mediante genéricos para evitar los casts en los controllers.

    const user = await authService.updateMe({ userId, data });

    const userResponse = toUserResponseDto(user);
    res.json(userResponse);
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const refreshToken = req.cookies.refreshToken as string | undefined;

    if (!refreshToken) {
      throw new UnauthorizedError("Refresh token required");
    }

    const result = await authService.refresh(refreshToken);

    setAccessTokenCookie(res, { token: result.accessToken, expiresAt: result.accessTokenExpiresAt });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function signOut(req: Request, res: Response, next: NextFunction) {
  try {
    const refreshToken = req.cookies.refreshToken as string | undefined;

    if (refreshToken) {
      await authService.signOut(refreshToken);
    }

    clearAuthCookies(res);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
