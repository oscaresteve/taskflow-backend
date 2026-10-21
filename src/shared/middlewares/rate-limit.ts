import { rateLimit } from "express-rate-limit";

import type { ErrorResponseDto } from "../dtos/error-response.dto.ts";

import { env } from "../../config/env.ts";

export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." } satisfies ErrorResponseDto,
});

export const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again later." } satisfies ErrorResponseDto,
});
