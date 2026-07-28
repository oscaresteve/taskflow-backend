import { AppError } from "./app-error.js";

export class SignInFailedError extends AppError {
  constructor(message = "Login failed") {
    super(message, 401);
  }
}
