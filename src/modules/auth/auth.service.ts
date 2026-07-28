import { ConflictError } from "../../shared/errors/conflict-error.ts";
import type { SignUpDto } from "./dtos/auth.dto.ts";
import * as authRepository from "./auth.repository.ts";
import { hashPassword } from "../../shared/security/password.ts";
import { generateAccessToken } from "../../shared/security/jwt.ts";
import type { User } from "./types/auth.types.ts";

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
