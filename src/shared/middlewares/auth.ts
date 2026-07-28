import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../errors/unauthorized-error.ts";
import { verifyAccessToken } from "../security/jwt.js";
import { getAuthenticatedUser } from "../../modules/auth/auth.service.ts";

export async function auth(req: Request, res: Response, next: NextFunction) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedError("Authentication required");
    }

    const [type, token] = authorization.split(" ");

    if (type !== "Bearer" || !token) {
      throw new UnauthorizedError("Invalid authorization header");
    }

    const payload = verifyAccessToken(token);

    const user = await getAuthenticatedUser(payload.sub);

    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
}
