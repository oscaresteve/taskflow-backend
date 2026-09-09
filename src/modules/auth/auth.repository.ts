import { prisma } from "../../config/prisma.ts";
import type { SignUpDto } from "./dtos/auth.dto.ts";
import type { UpdateMeDto } from "./schemas/auth.schema.ts";
import type { RefreshToken, User } from "../../shared/types/prisma.types.ts";

// Solo comunicarse con el ORM o DB

// Evitar hacer spread y transformar undefined en null en create, y en update omitir los campos que no vienen.

export async function findByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: {
      email,
    },
  });
}

export async function create(data: SignUpDto): Promise<User> {
  return prisma.user.create({
    data: {
      email: data.email,
      passwordHash: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      timezone: data.timezone,
      locale: data.locale,
    },
  });
}

export async function findById(id: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: {
      id,
    },
  });
}

export async function update({ id, data }: { id: string; data: UpdateMeDto }): Promise<User> {
  return prisma.user.update({
    where: {
      id,
    },
    data,
  });
}

export async function createRefreshToken({
  userId,
  tokenHash,
  expiresAt,
}: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<RefreshToken> {
  return prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });
}

export async function findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
  return prisma.refreshToken.findUnique({
    where: {
      tokenHash,
    },
  });
}

export async function revokeRefreshToken({ id }: { id: string }): Promise<RefreshToken> {
  return prisma.refreshToken.update({
    where: {
      id,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}
