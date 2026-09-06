import { LexoRank } from "lexorank";

// El orden de una tarea dentro de su columna es un LexoRank: una cadena que se compara
// lexicograficamente. Colocar una tarjeta entre otras dos es generar una cadena entre sus dos
// ranks, asi que mover una tarea escribe UNA sola fila y nunca hay que renumerar el resto.
//
// Frente a un entero espaciado (1000, 2000 -> 1500) la ventaja es que no existe el caso "el hueco
// se agoto": cuando no cabe nada entre dos vecinas la cadena crece un caracter mas. Por eso no hay
// ninguna rutina de rebalanceo, que es la parte fragil de ese enfoque.
//
// IMPORTANTE: la columna se compara byte a byte (COLLATE "C" en la migracion). Con la intercalacion
// por defecto de Postgres el orden de estas cadenas no coincidiria con el de la libreria.

/**
 * Devuelve un rank estrictamente mayor que `previous` y estrictamente menor que `next`.
 * `null` significa extremo abierto: (null, null) es la primera tarea de una columna vacia,
 * (null, x) va al principio y (x, null) al final.
 */
export function rankBetween(previous: string | null, next: string | null): string {
  if (previous && next) {
    return LexoRank.parse(previous).between(LexoRank.parse(next)).toString();
  }

  if (previous) return LexoRank.parse(previous).genNext().toString();

  if (next) return LexoRank.parse(next).genPrev().toString();

  return LexoRank.middle().toString();
}
