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
      JWT_ACCESS_SECRET: "vitest-integration-tests-dummy-access-secret-0123456789",
      JWT_ACCESS_EXPIRES_IN: "15m",
      JWT_REFRESH_SECRET: "vitest-integration-tests-dummy-refresh-secret-0123456789",
      JWT_REFRESH_EXPIRES_IN: "7d",
    },
  },
});
