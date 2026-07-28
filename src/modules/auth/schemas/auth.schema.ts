import { z } from "zod";

export const signUpBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede superar los 100 caracteres"),

  email: z.string().trim().toLowerCase().email("Email no válido"),

  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(128, "La contraseña es demasiado larga")
    .regex(/[a-z]/, "Debe contener al menos una letra minúscula")
    .regex(/[A-Z]/, "Debe contener al menos una letra mayúscula")
    .regex(/\d/, "Debe contener al menos un número"),
});

// TODO: Implementar confirmar contraseña

export const signInBodySchema = z.object({
  email: z.string().trim().toLowerCase().email("Email no válido"),

  password: z.string().min(1, "La contraseña es obligatoria"),
});

export type SignUpDto = z.infer<typeof signUpBodySchema>;
export type SignInDto = z.infer<typeof signInBodySchema>;
