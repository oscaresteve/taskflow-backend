import type { Server } from "socket.io";
import type { ActivityEventResponseDto } from "../modules/activity/dtos/activity.dto.ts";
import type { TaskStatus } from "../shared/types/prisma.types.ts";

// Solo tipos desde los modulos: en tiempo de ejecucion este fichero no importa nada de src/modules,
// que es lo que impide que el grafo de imports cierre sobre activity.repository.

// Todo mensaje lleva el actor para que el cliente pueda ignorar sus propios ecos y no pisarse las
// actualizaciones optimistas.
export type ActivityNewMessage = {
  actorId: string;
  event: ActivityEventResponseDto;
};

// Una reordenacion dentro de la misma columna no narra nada, asi que no es un evento de dominio,
// pero el tablero de los demas si tiene que enterarse.
export type TaskReorderedMessage = {
  actorId: string;
  taskId: string;
  status: TaskStatus;
  rank: string;
};

// Va vacio a proposito: el cliente invalida la campanita entera, no pinta este payload.
export type NotificationNewMessage = {
  actorId: string;
};

export interface ServerToClientEvents {
  "activity:new": (message: ActivityNewMessage) => void;
  "task:reordered": (message: TaskReorderedMessage) => void;
  "notification:new": (message: NotificationNewMessage) => void;
}

export interface ClientToServerEvents {
  "project:subscribe": (
    params: { workspaceSlug: string; projectSlug: string },
    ack?: (result: { ok: boolean }) => void,
  ) => void;
  "project:unsubscribe": () => void;
}

export interface SocketData {
  userId: string;
}

export type RealtimeServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export const projectRoom = (projectId: string) => `project:${projectId}`;
export const userRoom = (userId: string) => `user:${userId}`;

// Sin servidor los emisores no hacen nada. Es lo que permite que los repositorios sigan siendo
// importables desde los tests con supertest y desde el seed, que nunca levantan un socket.
let io: RealtimeServer | null = null;

export function setRealtimeServer(server: RealtimeServer | null): void {
  io = server;
}

export function emitActivityEvent(projectId: string, message: ActivityNewMessage): void {
  io?.to(projectRoom(projectId)).emit("activity:new", message);
}

export function emitTaskReordered(projectId: string, message: TaskReorderedMessage): void {
  io?.to(projectRoom(projectId)).emit("task:reordered", message);
}

export function emitNotification(userId: string, message: NotificationNewMessage): void {
  io?.to(userRoom(userId)).emit("notification:new", message);
}
