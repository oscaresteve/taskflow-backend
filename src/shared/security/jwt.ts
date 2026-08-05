import jwt from "jsonwebtoken";
import type { StringValue } from "ms";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env.ts";
import { UnauthorizedError } from "../errors/unauthorized-error.ts";

const accessExpiresIn = env.JWT_ACCESS_EXPIRES_IN as StringValue;
const refreshExpiresIn = env.JWT_REFRESH_EXPIRES_IN as StringValue;

interface AccessTokenPayload {
  sub: string;
}

interface RefreshTokenPayload {
  sub: string;
}

export function generateAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: accessExpiresIn });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as unknown as AccessTokenPayload;
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}

export function generateRefreshToken(payload: RefreshTokenPayload): { token: string; expiresAt: Date } {
  // jti aleatorio: sin esto, dos refresh tokens para el mismo user emitidos en el mismo
  // segundo firmarían el mismo JWT y colisionarían contra el @unique de tokenHash.
  const token = jwt.sign({ ...payload, jti: randomUUID() }, env.JWT_REFRESH_SECRET, { expiresIn: refreshExpiresIn });

  // El exp viene en segundos desde epoch; lo pasamos a Date para guardarlo en la DB.
  const { exp } = jwt.decode(token) as { exp: number };

  return { token, expiresAt: new Date(exp * 1000) };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as unknown as RefreshTokenPayload;
  } catch {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }
}
