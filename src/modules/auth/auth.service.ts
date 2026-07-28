import { ConflictError } from "../../shared/errors/conflict-error.ts";
import type { SignUpDto } from "./dtos/auth.dto.ts";
import * as authRepository from "./auth.repository.ts";
import { comparePassword, hashPassword } from "../../shared/security/password.ts";
import { generateAccessToken } from "../../shared/security/jwt.ts";
import type { User } from "./types/auth.types.ts";
import type { SignInDto } from "./schemas/auth.schema.ts";
import { SignInFailedError } from "../../shared/errors/sign-in-failed-error.ts";
import { UnauthorizedError } from "../../shared/errors/unauthorized-error.ts";

interface AuthResult {
  user: User;
  accessToken: string;
}

export async function signUp(data: SignUpDto): Promise<AuthResult> {
  const existingUser = await authRepository.findByEmail(data.email);

  if (existingUser) {
    throw new ConflictError("User already exists");
  }

  const passwordHash = await hashPassword(data.password);

  const user = await authRepository.create({
    ...data,
    password: passwordHash,
  });

  const accessToken = generateAccessToken({ sub: user.id });

  return { user, accessToken };
}

export async function signIn(data: SignInDto): Promise<AuthResult> {
  const user = await authRepository.findByEmail(data.email);

  if (!user) {
    throw new SignInFailedError("Invalid credentials");
  }

  const isValid = await comparePassword(data.password, user.passwordHash);

  if (!isValid) {
    throw new SignInFailedError("Invalid credentials");
  }

  const accessToken = generateAccessToken({ sub: user.id });

  return { user, accessToken };
}

export async function getAuthenticatedUser(userId: string): Promise<User> {
  const user = await authRepository.findById(userId);

  if (!user) {
    throw new UnauthorizedError("Authentication required");
  }

  return user;
}
