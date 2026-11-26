// Contenedor MinIO dedicado a tests (minio-test en docker-compose.yml), separado del de dev.
export const TEST_S3_ENDPOINT = "http://localhost:9002";
export const TEST_S3_REGION = "us-east-1";
export const TEST_S3_ACCESS_KEY_ID = "minioadmin";
export const TEST_S3_SECRET_ACCESS_KEY = "minioadmin123";
export const TEST_S3_BUCKET_NAME = "taskflow-avatars-test";
export const TEST_S3_PUBLIC_URL_BASE = "http://localhost:9002/taskflow-avatars-test";
