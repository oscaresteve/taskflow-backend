import { ConflictError } from "../../shared/errors/conflict-error.ts";
import type { SignUpDto } from "./dtos/auth.dto.ts";
import * as authRepository from "./auth.repository.ts";
import { comparePassword, hashPassword } from "../../shared/security/password.ts";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../../shared/security/jwt.ts";
import { hashToken } from "../../shared/security/hash-token.ts";
import type { User } from "../../shared/types/prisma.types.ts";
import type { SignInDto, UpdateMeDto } from "./schemas/auth.schema.ts";
import { SignInFailedError } from "../../shared/errors/sign-in-failed-error.ts";
import { UnauthorizedError } from "../../shared/errors/unauthorized-error.ts";

interface AuthResult {
  user: User;
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

async function issueRefreshToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const { token, expiresAt } = generateRefreshToken({ sub: userId });

  await authRepository.createRefreshToken({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });

  return { token, expiresAt };
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

  const { token: accessToken, expiresAt: accessTokenExpiresAt } = generateAccessToken({ sub: user.id });
  const { token: refreshToken, expiresAt: refreshTokenExpiresAt } = await issueRefreshToken(user.id);

  return { user, accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt };
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

  const { token: accessToken, expiresAt: accessTokenExpiresAt } = generateAccessToken({ sub: user.id });
  const { token: refreshToken, expiresAt: refreshTokenExpiresAt } = await issueRefreshToken(user.id);

  return { user, accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt };
}

export async function getAuthenticatedUser(userId: string): Promise<User> {
  const user = await authRepository.findById(userId);

  if (!user) {
    throw new UnauthorizedError("Authentication required");
  }

  return user;
}

export async function updateMe({ userId, data }: { userId: string; data: UpdateMeDto }): Promise<User> {
  const user = await authRepository.update({ id: userId, data });

  return user;
}

export async function refresh(refreshToken: string): Promise<{ accessToken: string; accessTokenExpiresAt: Date }> {
  const payload = verifyRefreshToken(refreshToken);

  const record = await authRepository.findRefreshTokenByHash(hashToken(refreshToken));

  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  const { token: accessToken, expiresAt: accessTokenExpiresAt } = generateAccessToken({ sub: payload.sub });

  return { accessToken, accessTokenExpiresAt };
}

export async function signOut(refreshToken: string): Promise<void> {
  const record = await authRepository.findRefreshTokenByHash(hashToken(refreshToken));

  if (!record || record.revokedAt) {
    return;
  }

  await authRepository.revokeRefreshToken({ id: record.id });
}
