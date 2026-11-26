import { Router } from "express";
import * as notificationsController from "./notifications.controller.ts";
import { auth } from "../../shared/middlewares/auth.ts";
import { validate } from "../../shared/middlewares/validate.ts";
import { notificationParamsSchema, notificationQuerySchema } from "./schemas/notifications.schema.ts";

export const notificationsRouter = Router();

// 1. Mis notificaciones
// GET    /notifications
notificationsRouter.get(
  "/notifications",
  auth,
  validate({ query: notificationQuerySchema }),
  notificationsController.findAll,
);

// 2. Contador de no leidas
// GET    /notifications/unread-count
// Va antes que /notifications/:notificationId no haria falta (no hay colision), pero se mantiene
// junto al listado por legibilidad: las dos lecturas primero.
notificationsRouter.get("/notifications/unread-count", auth, notificationsController.countUnread);

// 3. Marcar todas como leidas
// PATCH  /notifications/read-all
// Antes que la de una sola: "read-all" entraria por la ruta del id y fallaria la validacion de cuid.
notificationsRouter.patch("/notifications/read-all", auth, notificationsController.markAllAsRead);

// 4. Marcar una como leida
// PATCH  /notifications/:notificationId/read
notificationsRouter.patch(
  "/notifications/:notificationId/read",
  auth,
  validate({ params: notificationParamsSchema }),
  notificationsController.markAsRead,
);
