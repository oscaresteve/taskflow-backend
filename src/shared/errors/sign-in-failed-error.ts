import { AppError } from "./app-error.ts";

export class SignInFailedError extends AppError {
  constructor(message = "Login failed") {
    super(message, 401);
  }
}
