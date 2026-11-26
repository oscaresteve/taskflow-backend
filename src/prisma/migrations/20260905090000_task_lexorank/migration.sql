-- El orden dentro de una columna del tablero pasa de un entero consecutivo a un LexoRank.
-- Mover una tarea deja de reescribir toda la columna: basta con generar un rank entre el de sus dos
-- vecinas y actualizar una sola fila.

-- COLLATE "C" es imprescindible: hace que Postgres compare la cadena byte a byte, igual que
-- JavaScript. Con la intercalacion por defecto (en_US.UTF-8 y similares) el orden de estos ranks no
-- coincidiria con el que genera la aplicacion.
ALTER TABLE "Task" ADD COLUMN "rank" TEXT COLLATE "C";

-- Backfill conservando el orden actual de cada columna. Se reparten ranks espaciados usando solo
-- digitos, que forman parte del alfabeto [0-9a-z] del generador, asi que las inserciones
-- posteriores encuentran hueco entre ellos sin problema.
UPDATE "Task" AS t
SET "rank" = lpad((ordered.rn * 1000)::text, 10, '0')
FROM (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY "projectId", "status"
      ORDER BY "position", "taskNumber"
    ) AS rn
  FROM "Task"
) AS ordered
WHERE t.id = ordered.id;

ALTER TABLE "Task" ALTER COLUMN "rank" SET NOT NULL;

-- DropIndex
DROP INDEX "Task_projectId_status_position_idx";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "position";

-- CreateIndex
CREATE INDEX "Task_projectId_status_rank_idx" ON "Task"("projectId", "status", "rank");
