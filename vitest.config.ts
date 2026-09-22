import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./tests/setup/test-database-url.ts";
import {
  TEST_S3_ACCESS_KEY_ID,
  TEST_S3_BUCKET_NAME,
  TEST_S3_ENDPOINT,
  TEST_S3_PUBLIC_URL_BASE,
  TEST_S3_REGION,
  TEST_S3_SECRET_ACCESS_KEY,
} from "./tests/setup/test-s3-config.ts";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/setup/global-setup.ts"],
    setupFiles: ["./tests/setup/db.ts"],
    fileParallelism: false, // tests share one Postgres schema y un mismo bucket, se resetean entre cada test
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      BCRYPT_SALT_ROUNDS: "10",
      JWT_ACCESS_SECRET: "vitest-integration-tests-dummy-access-secret-0123456789",
      JWT_ACCESS_EXPIRES_IN: "15m",
      JWT_REFRESH_SECRET: "vitest-integration-tests-dummy-refresh-secret-0123456789",
      JWT_REFRESH_EXPIRES_IN: "7d",
      S3_ENDPOINT: TEST_S3_ENDPOINT,
      S3_REGION: TEST_S3_REGION,
      S3_ACCESS_KEY_ID: TEST_S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY: TEST_S3_SECRET_ACCESS_KEY,
      S3_BUCKET_NAME: TEST_S3_BUCKET_NAME,
      S3_FORCE_PATH_STYLE: "true",
      S3_PUBLIC_URL_BASE: TEST_S3_PUBLIC_URL_BASE,
    },
  },
});
