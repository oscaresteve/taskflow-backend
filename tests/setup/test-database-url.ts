// Contenedor Docker Compose dedicado a tests, separado del de dev (docker-compose.yml).
export const TEST_DATABASE_URL = "postgresql://taskflow:taskflow@localhost:5433/taskflow_test?schema=public";
