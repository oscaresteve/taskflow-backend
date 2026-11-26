import { execSync } from "node:child_process";
import { Client } from "pg";
import { TEST_DATABASE_URL } from "./test-database-url.ts";

const testDatabaseUrl = TEST_DATABASE_URL;

// Se recrea el schema "public" desde cero para que cada ejecución de la suite
// parta de una base limpia, igual que antes se borraba el fichero de SQLite.
async function resetSchema() {
  const client = new Client({ connectionString: testDatabaseUrl });
  await client.connect();
  await client.query('DROP SCHEMA IF EXISTS "public" CASCADE');
  await client.query('CREATE SCHEMA "public"');
  await client.end();
}

export default async function globalSetup() {
  await resetSchema();

  execSync("node_modules/.bin/prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
  });

  return resetSchema;
}
