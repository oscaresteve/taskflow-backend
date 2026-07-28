import { Prisma } from "../../prisma/generated/prisma/client.ts";

export function isPrismaKnownRequestError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string";
}
