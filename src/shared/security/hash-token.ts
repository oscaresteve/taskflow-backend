import { createHash } from "node:crypto";

// SHA-256 y no bcrypt: el refresh token ya es de alta entropía y necesitamos
// un lookup exacto por hash en la DB, no una comparación tipo contraseña.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
