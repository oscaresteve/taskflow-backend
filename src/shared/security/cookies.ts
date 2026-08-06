import type { Response } from "express";
import { env } from "../../config/env.ts";

const isProduction = env.NODE_ENV !== "development";

export function setAccessTokenCookie(res: Response, { token, expiresAt }: { token: string; expiresAt: Date }) {
  res.cookie("accessToken", token, {
    httpOnly: true,
    secure: isProduction,
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
    path: "/api/auth", // El refresh token solo se envia en /auth
    expires: expiresAt,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie("accessToken", { path: "/" });
  res.clearCookie("refreshToken", { path: "/api/auth" });
}
