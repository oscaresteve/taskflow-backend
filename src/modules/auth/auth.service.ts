import { randomUUID } from "node:crypto";
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
import { BadRequestError } from "../../shared/errors/bad-request-error.ts";
import { NotFoundError } from "../../shared/errors/not-found-error.ts";
import {
  AVATAR_EXTENSION_BY_CONTENT_TYPE,
  MAX_AVATAR_SIZE_BYTES,
  type AvatarUploadUrlDto,
  type ConfirmAvatarDto,
} from "../../shared/schemas/common.schema.ts";
import { deleteObject, getUploadUrl, headObject } from "../../shared/storage/storage.service.ts";

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

  const existingUsername = await authRepository.findByUsername(data.username);

  if (existingUsername) {
    throw new ConflictError("Username is already taken");
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
  // El username es publico y unico, asi que cambiarlo puede chocar con el de otro. Las menciones ya
  // escritas no se rompen: guardan el id, no el nombre.
  if (data.username) {
    const existingUsername = await authRepository.findByUsername(data.username);

    if (existingUsername && existingUsername.id !== userId) {
      throw new ConflictError("Username is already taken");
    }
  }

  const user = await authRepository.update({ id: userId, data });

  return user;
}

export async function getAvatarUploadUrl({
  userId,
  data,
}: {
  userId: string;
  data: AvatarUploadUrlDto;
}): Promise<{ uploadUrl: string; key: string }> {
  // La key vive bajo el prefijo del usuario, así confirmAvatar puede comprobar que le pertenece
  const extension = AVATAR_EXTENSION_BY_CONTENT_TYPE[data.contentType];
  const key = `users/${userId}/avatar-${randomUUID()}.${extension}`;

  const uploadUrl = await getUploadUrl({ key, contentType: data.contentType, contentLength: data.fileSize });

  return { uploadUrl, key };
}

export async function confirmAvatar({
  userId,
  currentAvatarKey,
  data,
}: {
  userId: string;
  currentAvatarKey: string | null;
  data: ConfirmAvatarDto;
}): Promise<User> {
  // La key debe ser una que nosotros mismos hayamos firmado para este usuario
  if (!data.key.startsWith(`users/${userId}/`)) {
    throw new BadRequestError("Invalid avatar key");
  }

  // No nos fiamos de lo que el cliente dijo que iba a subir: comprobamos el archivo real en el bucket
  const uploadedObject = await headObject({ key: data.key });
  if (!uploadedObject) {
    throw new BadRequestError("Avatar file was not uploaded");
  }

  const isValidContentType = uploadedObject.contentType && uploadedObject.contentType in AVATAR_EXTENSION_BY_CONTENT_TYPE;
  const isValidSize = uploadedObject.contentLength > 0 && uploadedObject.contentLength <= MAX_AVATAR_SIZE_BYTES;

  if (!isValidContentType || !isValidSize) {
    await deleteObject({ key: data.key });
    throw new BadRequestError("Uploaded file does not meet the avatar requirements");
  }

  // Si había un avatar anterior, lo borramos del bucket para no dejar objetos huérfanos
  if (currentAvatarKey) {
    await deleteObject({ key: currentAvatarKey });
  }

  return authRepository.updateAvatarKey({ id: userId, avatarKey: data.key });
}

export async function deleteAvatar({
  userId,
  currentAvatarKey,
}: {
  userId: string;
  currentAvatarKey: string | null;
}): Promise<void> {
  if (!currentAvatarKey) {
    throw new NotFoundError("User has no avatar");
  }

  await deleteObject({ key: currentAvatarKey });
  await authRepository.updateAvatarKey({ id: userId, avatarKey: null });
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
