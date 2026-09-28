-- Nullable primero: la columna es obligatoria, pero hay usuarios que ya existen y necesitan valor.
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- Relleno determinista desde la parte local del email: se normaliza a [a-z0-9_], se recorta a 30,
-- se asegura un minimo de 3 caracteres y se desempata con un sufijo numerico estable por id.
WITH normalized AS (
    SELECT
        id,
        trim(BOTH '_' FROM left(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9]+', '_', 'g'), 30)) AS cleaned
    FROM "User"
),
base AS (
    SELECT
        id,
        CASE WHEN length(cleaned) < 3 THEN rpad(cleaned, 3, '0') ELSE cleaned END AS value
    FROM normalized
),
numbered AS (
    SELECT
        id,
        value,
        ROW_NUMBER() OVER (PARTITION BY value ORDER BY id) AS position
    FROM base
)
UPDATE "User" u
SET "username" = CASE WHEN n.position = 1 THEN n.value ELSE n.value || n.position::text END
FROM numbered n
WHERE u.id = n.id;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
