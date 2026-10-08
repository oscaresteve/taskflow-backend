import { isPrismaKnownRequestError } from "../errors/is-prisma-error.ts";

const MAX_ATTEMPTS = 3;

// Dos creaciones simultáneas con el mismo nombre calculan el mismo slug antes de que ninguna haya
// escrito, así que la segunda choca en el índice único y responde un 409 que no toca: el sufijo
// existe para que esa colisión no se vea. Al reintentar, la fila de la primera ya está, el `exists`
// la ve y se coge el sufijo siguiente. Con más de tres a la vez, la que sobra sí acaba en 409.
export default async function retryOnUniqueViolation<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isUniqueViolation = isPrismaKnownRequestError(error) && error.code === "P2002";

      if (!isUniqueViolation || attempt === MAX_ATTEMPTS) throw error;
    }
  }
}
