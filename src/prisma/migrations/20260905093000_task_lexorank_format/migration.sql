-- El orden pasa a generarse con la libreria `lexorank`, cuyo formato es <bucket>|<6 base36>:<decimales>
-- (por ejemplo "0|hzzzzz:"). Los ranks que dejo la migracion anterior eran digitos con relleno, que
-- la libreria no sabe interpretar, asi que hay que reescribirlos respetando el orden actual.

-- Se reproduce la progresion de la propia libreria: LexoRank.middle() es "0|hzzzzz:", que en base 36
-- vale 1088391167, y cada genNext() suma 8. La expresion de abajo convierte ese entero a las 6
-- cifras en base 36 que espera el formato.
UPDATE "Task" AS t
SET "rank" = '0|' || (
  SELECT string_agg(
    substr('0123456789abcdefghijklmnopqrstuvwxyz', ((ordered.value / power(36, digit)::bigint) % 36)::int + 1, 1),
    ''
    ORDER BY digit DESC
  )
  FROM generate_series(0, 5) AS digit
) || ':'
FROM (
  SELECT
    id,
    1088391167 + 8 * (
      row_number() OVER (
        PARTITION BY "projectId", "status"
        ORDER BY "rank", "taskNumber"
      ) - 1
    ) AS value
  FROM "Task"
) AS ordered
WHERE t.id = ordered.id;
