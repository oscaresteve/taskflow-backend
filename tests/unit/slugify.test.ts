import { describe, expect, it } from "vitest";
import { nameSchema, slugSchema } from "../../src/shared/schemas/common.schema.ts";
import slugify from "../../src/shared/utils/slugify.ts";

// Lo que de verdad importa de slugify no es cada cadena concreta, sino que su salida sea siempre
// direccionable: toda la API pide los recursos por slug validandolo con slugSchema, asi que un slug
// que no pase ese regex crea una fila que ya nadie puede volver a pedir, ni para renombrarla.
describe("slugify", () => {
  const cases = [
    // El strip de caracteres especiales deja el espacio, que luego se convierte en guion: de ahi
    // que un nombre que empieza por emoji saliera antes como "-launch".
    { name: "🚀 Launch", slug: "launch" },
    { name: "- Hola", slug: "hola" },
    { name: "Hola -", slug: "hola" },
    { name: "--Mi--Proyecto--", slug: "mi-proyecto" },
    { name: "Café & Té", slug: "cafe-te" },
    { name: "Website Redesign", slug: "website-redesign" },
  ];

  it.for(cases)("turns $name into $slug", ({ name, slug }) => {
    expect(slugify(name)).toBe(slug);
  });

  it("produces a slug that slugSchema accepts", () => {
    for (const { name } of cases) {
      expect(slugSchema.safeParse(slugify(name)).success).toBe(true);
    }
  });

  // Sin ningun caracter aprovechable no hay slug posible: slugify devuelve "" y es nameSchema quien
  // corta la peticion, en lugar de guardar una fila inalcanzable.
  it("returns an empty string when the name has nothing sluggable, and nameSchema rejects it", () => {
    for (const name of ["日本語", "Проект", "...", "--"]) {
      expect(slugify(name)).toBe("");
      expect(nameSchema.safeParse(name).success).toBe(false);
    }
  });
});
