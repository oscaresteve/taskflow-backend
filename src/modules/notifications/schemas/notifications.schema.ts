import z from "zod";
import { limitSchema, pageSchema } from "../../../shared/schemas/common.schema.ts";

// La campanita siempre va de lo mas reciente a lo mas antiguo, igual que el historial.
export const notificationQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
});

export const notificationParamsSchema = z.object({
  notificationId: z.cuid(),
});

export type NotificationQueryDto = z.infer<typeof notificationQuerySchema>;
export type NotificationParamsDto = z.infer<typeof notificationParamsSchema>;
