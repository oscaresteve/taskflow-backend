import type { PaginatedResponseDto } from "../../../shared/dtos/pagination.dto.ts";
import type { PaginatedResult } from "../../../shared/types/pagination.types.ts";
import { toActivityEventResponse } from "../../activity/mappers/activity.mapper.ts";
import type { NotificationResponseDto } from "../dtos/notifications.dto.ts";
import type { NotificationWithEvent } from "../notifications.repository.ts";

// Devuelve null por el mismo motivo que el historial: si el payload no encaja con su accion, la
// entrada suelta se cae en vez de tumbar la campanita entera.
function toNotificationResponse(notification: NotificationWithEvent): NotificationResponseDto | null {
  const event = toActivityEventResponse(notification.event);

  if (!event) return null;

  return {
    id: notification.id,

    readAt: notification.readAt,

    createdAt: notification.createdAt,

    event,

    workspaceSlug: notification.event.workspace.slug,
  };
}

export function toNotificationResponseDtoList(notifications: NotificationWithEvent[]): NotificationResponseDto[] {
  return notifications.map(toNotificationResponse).filter((notification) => notification !== null);
}

export function toPaginatedNotificationResponseDto({
  notifications,
  page,
  limit,
}: {
  notifications: PaginatedResult<NotificationWithEvent>;
  page: number;
  limit: number;
}): PaginatedResponseDto<NotificationResponseDto> {
  return {
    data: toNotificationResponseDtoList(notifications.items),

    pagination: {
      page,
      limit,
      total: notifications.total,
      pages: Math.ceil(notifications.total / limit),
    },
  };
}
