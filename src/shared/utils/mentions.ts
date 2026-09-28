// Una mencion se guarda en el texto del comentario como @[Nombre visible](userId). Lleva el id
// porque es lo unico inmutable, y lleva el nombre para que el texto siga leyendose si el usuario ya
// no pertenece al proyecto: el render pinta el nombre actual resolviendo el id y solo cae al
// guardado cuando no lo encuentra.
const MENTION_PATTERN = /@\[[^\]\n]{1,100}\]\(([A-Za-z0-9_-]{1,64})\)/g;

export function extractMentionedUserIds(content: string): string[] {
  const ids = new Set<string>();

  for (const match of content.matchAll(MENTION_PATTERN)) {
    ids.add(match[1]);
  }

  return [...ids];
}
