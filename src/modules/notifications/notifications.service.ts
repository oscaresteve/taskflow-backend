import { NotFoundError } from "../../shared/errors/not-found-error.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import * as notificationsRepository from "./notifications.repository.ts";
import type { NotificationWithEvent } from "./notifications.repository.ts";
import type { NotificationQueryDto } from "./schemas/notifications.schema.ts";

// Las notificaciones son del usuario, no de un espacio: no hay contexto que resolver mas alla de
// quien pregunta, y el alcance lo aplica el propio repositorio.

export async function findAll({
  userId,
  query,
}: {
  userId: string;
  query: NotificationQueryDto;
}): Promise<PaginatedResult<NotificationWithEvent>> {
  return notificationsRepository.findAll({ userId, query });
}

export async function countUnread(userId: string): Promise<number> {
  return notificationsRepository.countUnread(userId);
}

export async function markAsRead({
  userId,
  notificationId,
}: {
  userId: string;
  notificationId: string;
}): Promise<void> {
  const notification = await notificationsRepository.findById({ notificationId, userId });

  if (!notification) throw new NotFoundError("Notification not found");

  // Marcarla como leida es idempotente. La campanita la marca al abrirla, asi que un doble clic o un
  // reintento llegan con la notificacion ya leida, y eso no es un conflicto que el cliente pueda
  // resolver: el estado que pedia ya es el que hay.
  if (notification.readAt) return;

  await notificationsRepository.markAsRead(notificationId);
}

export async function markAllAsRead(userId: string): Promise<void> {
  await notificationsRepository.markAllAsRead(userId);
}
