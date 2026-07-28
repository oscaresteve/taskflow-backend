import jwt from "jsonwebtoken";
import type { StringValue } from "ms";
import { env } from "../../config/env.ts";
import { UnauthorizedError } from "../errors/unauthorized-error.ts";

const expiresIn = env.JWT_EXPIRES_IN as StringValue;

interface AccessTokenPayload {
  sub: string;
}

export function generateAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as unknown as AccessTokenPayload;
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}
