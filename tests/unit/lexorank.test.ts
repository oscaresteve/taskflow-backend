import { describe, expect, it } from "vitest";
import { rankBetween } from "../../src/shared/utils/lexorank.ts";

// El orden de los ranks se decide en Postgres con COLLATE "C", es decir comparando byte a byte,
// que es justo lo que hace el operador < de JavaScript sobre cadenas ASCII. Por eso aqui se
// comprueba con < y no con la API de la libreria: lo que importa es que la base ordene igual.
describe("rankBetween", () => {
  it("places a rank between its two neighbours", () => {
    const first = rankBetween(null, null);
    const last = rankBetween(first, null);
    const middle = rankBetween(first, last);

    expect(first < middle).toBe(true);
    expect(middle < last).toBe(true);
  });

  it("appends after the last rank and prepends before the first", () => {
    const only = rankBetween(null, null);

    expect(rankBetween(only, null) > only).toBe(true);
    expect(rankBetween(null, only) < only).toBe(true);
  });

  // El caso que en un esquema de enteros agota el hueco y obliga a renumerar: aqui la cadena crece
  // y el orden se mantiene.
  it("keeps ordering after many inserts into the same slot", () => {
    let low = rankBetween(null, null);
    const high = rankBetween(low, null);

    for (let index = 0; index < 200; index += 1) {
      const inserted = rankBetween(low, high);

      expect(low < inserted).toBe(true);
      expect(inserted < high).toBe(true);

      low = inserted;
    }
  });

  it("keeps ordering when always inserting at the head", () => {
    let head = rankBetween(null, null);

    for (let index = 0; index < 200; index += 1) {
      const inserted = rankBetween(null, head);

      expect(inserted < head).toBe(true);

      head = inserted;
    }
  });

  it("keeps ordering when always appending at the tail", () => {
    let tail = rankBetween(null, null);

    for (let index = 0; index < 200; index += 1) {
      const inserted = rankBetween(tail, null);

      expect(inserted > tail).toBe(true);

      tail = inserted;
    }
  });

  // Insercion en posiciones aleatorias: el orden global tiene que aguantar siempre.
  it("keeps the whole list ordered under random insertions", () => {
    const ranks = [rankBetween(null, null)];

    for (let index = 0; index < 500; index += 1) {
      const at = Math.floor(Math.random() * (ranks.length + 1));
      const inserted = rankBetween(ranks[at - 1] ?? null, ranks[at] ?? null);
      ranks.splice(at, 0, inserted);
    }

    expect(ranks).toEqual([...ranks].sort());
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  // Formato de la libreria: <bucket>|<6 cifras base36>:<decimales opcionales>. La migracion depende
  // de que sea exactamente este, porque genera los ranks del backfill en SQL.
  it("produces ranks in the library's bucket format", () => {
    expect(rankBetween(null, null)).toBe("0|hzzzzz:");
    expect(rankBetween(null, null)).toMatch(/^0\|[0-9a-z]{6}:[0-9a-z]*$/);
  });
});
