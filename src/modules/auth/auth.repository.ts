import { prisma } from "../../config/prisma.ts";
import type { SignUpDto } from "./dtos/auth.dto.ts";
import type { User } from "./types/auth.types.ts";

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
      name: data.name,
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
