import z from "zod";
import {
  booleanQueryParamSchema,
  descriptionSchema,
  limitSchema,
  pageSchema,
  searchSchema,
  sortOrderSchema,
} from "../../../shared/schemas/common.schema.ts";

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters long")
    .max(100, "Name cannot exceed 100 characters"),
  description: descriptionSchema,
});

export const updateWorkspaceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters long")
      .max(100, "Name cannot exceed 100 characters")
      .optional(),
    description: descriptionSchema.nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, "At least one field must be provided");
// Como todos los campos son opcionales se valida que al menos se envie un campo

const sortableFields = ["name", "createdAt", "updatedAt"] as const;

const isActiveQueryParamSchema = z.enum(["true", "false"]).transform((value) => value === "true");

export const workspaceQuerySchema = z.object({
  // Paginacion
  page: pageSchema,
  limit: limitSchema,

  // Filtros
  // Acepta un isActive ("?isActive=true") o varios ("?isActive=true&isActive=false").
  isActive: z.union([isActiveQueryParamSchema, z.array(isActiveQueryParamSchema)]).optional(),
  isFavorite: booleanQueryParamSchema,
  search: searchSchema,

  // Ordenacion
  sort: z.enum(sortableFields).default("createdAt"),
  order: sortOrderSchema,
});

// Avatar del workspace: tipos de imagen permitidos y tamaño máximo, compartidos entre
// la validación de la petición (aquí) y la comprobación real del archivo subido (workspaces.service.ts).
export const avatarContentTypeSchema = z.enum(["image/png", "image/jpeg", "image/webp"]);
export type AvatarContentType = z.infer<typeof avatarContentTypeSchema>;

export const AVATAR_EXTENSION_BY_CONTENT_TYPE: Record<AvatarContentType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export const avatarUploadUrlSchema = z.object({
  contentType: avatarContentTypeSchema,
  fileSize: z
    .number()
    .int()
    .positive()
    .max(MAX_AVATAR_SIZE_BYTES, `File size cannot exceed ${MAX_AVATAR_SIZE_BYTES} bytes`),
});

export const confirmAvatarSchema = z.object({
  key: z.string().min(1),
});

export type CreateWorkspaceDto = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceDto = z.infer<typeof updateWorkspaceSchema>;
export type WorkspaceQueryDto = z.infer<typeof workspaceQuerySchema>;
export type AvatarUploadUrlDto = z.infer<typeof avatarUploadUrlSchema>;
export type ConfirmAvatarDto = z.infer<typeof confirmAvatarSchema>;
