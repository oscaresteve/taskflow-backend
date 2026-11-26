import { AppError } from "./app-error.ts";

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409);
  }
}
