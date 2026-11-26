import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import type { ErrorResponseDto, ValidationErrorResponseDto } from "../dtos/error-response.dto.ts";

import { AppError } from "../errors/app-error.ts";
import { isPrismaKnownRequestError } from "../errors/is-prisma-error.ts";

function toValidationErrorResponse(err: ZodError): ValidationErrorResponseDto {
  return {
    message: "Validation failed",
    errors: err.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  };
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (err instanceof ZodError) {
    return res.status(400).json(toValidationErrorResponse(err));
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
    } satisfies ErrorResponseDto);
  }

  if (isPrismaKnownRequestError(err)) {
    switch (err.code) {
      case "P2002":
        return res.status(409).json({
          message: "Resource already exists",
        } satisfies ErrorResponseDto);

      case "P2025":
        return res.status(404).json({
          message: "Resource not found",
        } satisfies ErrorResponseDto);

      default:
        return res.status(400).json({
          message: "Database error",
        } satisfies ErrorResponseDto);
    }
  }

  console.error(err);

  return res.status(500).json({
    message: "Internal Server Error",
  } satisfies ErrorResponseDto);
};
