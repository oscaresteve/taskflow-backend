import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/setup/global-setup.ts"],
    setupFiles: ["./tests/setup/db.ts"],
    fileParallelism: false, // tests share one SQLite file and reset it between each test
    env: {
      DATABASE_URL: "file:./test.db",
      BCRYPT_SALT_ROUNDS: "10",
      JWT_SECRET: "vitest-integration-tests-dummy-secret-key-0123456789",
      JWT_EXPIRES_IN: "15m",
    },
  },
});
