import type { ActivityEventResponseDto } from "../../activity/dtos/activity.dto.ts";

// La notificacion no duplica el contenido: lleva su evento, y la frase la compone el mismo
// componente que el historial.
export type NotificationResponseDto = {
  id: string;

  readAt: Date | null;

  createdAt: Date;

  event: ActivityEventResponseDto;

  // El espacio y el proyecto donde ocurrio, para poder enlazar desde una campanita que es global.
  workspaceSlug: string;
};

export type UnreadCountResponseDto = {
  unread: number;
};
