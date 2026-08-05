import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";

const testDbPath = "./test.db";
const testDbUrl = `file:${testDbPath}`;

function removeTestDbFiles() {
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    const file = `${testDbPath}${suffix}`;
    if (existsSync(file)) unlinkSync(file);
  }
}

export default async function globalSetup() {
  removeTestDbFiles();

  execSync("node_modules/.bin/prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testDbUrl },
  });

  return removeTestDbFiles;
}
