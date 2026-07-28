import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../generated/prisma/client.ts";
import { env } from "../config/env.ts";

const adapter = new PrismaBetterSqlite3({
  url: env.DATABASE_URL,
});

export const prisma = new PrismaClient({ adapter });
