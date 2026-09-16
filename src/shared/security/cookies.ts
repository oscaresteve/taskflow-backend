import type { Response } from "express";
import { env } from "../../config/env.ts";

const isProduction = env.NODE_ENV !== "development";

export function setAccessTokenCookie(res: Response, { token, expiresAt }: { token: string; expiresAt: Date }) {
  res.cookie("accessToken", token, {
    httpOnly: true,
    secure: isProduction, // En produccion las cookies solo se podran usar mediante HTTPS
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function setRefreshTokenCookie(res: Response, { token, expiresAt }: { token: string; expiresAt: Date }) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    // El proxy de Next necesita recibir esta cookie en cualquier navegacion para poder renovar
    // el access token en el servidor, asi que no se puede acotar a /api/auth.
    path: "/",
    expires: expiresAt,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie("accessToken", { path: "/" });
  res.clearCookie("refreshToken", { path: "/" });
}
