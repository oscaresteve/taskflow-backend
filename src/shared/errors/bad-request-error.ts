import { AppError } from "./app-error.ts";

export class BadRequestError extends AppError {
  constructor(message = "Bad Request") {
    super(message, 400);
  }
}
