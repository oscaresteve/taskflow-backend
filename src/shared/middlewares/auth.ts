import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../errors/unauthorized-error.ts";
import { verifyAccessToken } from "../security/jwt.js";
import { getAuthenticatedUser } from "../../modules/auth/auth.service.ts";

export async function auth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies.accessToken as string | undefined;

    if (!token) {
      throw new UnauthorizedError("Authentication required");
    }

    const payload = verifyAccessToken(token);

    const user = await getAuthenticatedUser(payload.sub);

    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
}
