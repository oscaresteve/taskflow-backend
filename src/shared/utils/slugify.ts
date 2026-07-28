export default function slugify(text: string) {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Elimina acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // Elimina caracteres especiales
    .replace(/\s+/g, "-") // Espacios -> -
    .replace(/-+/g, "-"); // Evita -- repetidos
}
