import { z } from "zod";
import { localeSchema } from "../../../shared/schemas/common.schema.ts";

export const signUpSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, "First name must be at least 2 characters long")
      .max(100, "First name cannot exceed 100 characters"),

    lastName: z
      .string()
      .trim()
      .min(2, "Last name must be at least 2 characters long")
      .max(100, "Last name cannot exceed 100 characters"),

    email: z.string().trim().toLowerCase().email("Email must be a valid email address"),

    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .max(128, "Password cannot exceed 128 characters")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/\d/, "Password must contain at least one number"),

    confirmPassword: z.string(),

    timezone: z.string().min(1, "Timezone is required"),

    locale: localeSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email must be a valid email address"),

  password: z.string().min(1, "Password is required"),
});

export const updateMeSchema = z
  .object({
    locale: localeSchema.optional(),
    timezone: z.string().min(1, "Timezone is required").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "At least one field must be provided");

export type SignUpDto = z.infer<typeof signUpSchema>;
export type SignInDto = z.infer<typeof signInSchema>;
export type UpdateMeDto = z.infer<typeof updateMeSchema>;
