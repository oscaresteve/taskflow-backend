import { prisma } from "../../config/prisma.ts";
import type { Prisma } from "../../prisma/generated/prisma/client.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { ActivityEventWithActor } from "../activity/types/activity.types.ts";
import { attachTargets, personSelect, projectSelect, reachableEventsBy } from "../activity/activity.repository.ts";
import type { NotificationQueryDto } from "./schemas/notifications.schema.ts";

export type NotificationWithEvent = {
  id: string;
  readAt: Date | null;
  createdAt: Date;
  event: ActivityEventWithActor & { workspace: { slug: string } };
};

// La campanita es global, asi que su alcance no lo da una ruta: se filtra aqui, con la misma regla
// que el feed de espacio, para que no queden notificaciones que enlazan a algo que ya da 404.
function reachableBy(userId: string): Prisma.NotificationWhereInput {
  return {
    userId,
    event: reachableEventsBy(userId),
  };
}

const eventInclude = {
  actor: {
    select: personSelect,
  },
  project: {
    select: projectSelect,
  },
  workspace: {
    select: { slug: true },
  },
} as const;

export async function findAll({
  userId,
  query,
}: {
  userId: string;
  query: NotificationQueryDto;
}): Promise<PaginatedResult<NotificationWithEvent>> {
  const where = reachableBy(userId);

  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: query.limit,
      include: {
        event: { include: eventInclude },
      },
    }),

    prisma.notification.count({ where }),
  ]);

  // La persona de la que habla cada evento se resuelve igual que en el historial: su id vive en el
  // payload y no hay join que lo traiga.
  const events = await attachTargets(items.map((notification) => notification.event));

  return {
    items: items.map((notification, index) => ({ ...notification, event: events[index] })),
    total,
  };
}

export async function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { ...reachableBy(userId), readAt: null },
  });
}

export async function findById({
  notificationId,
  userId,
}: {
  notificationId: string;
  userId: string;
}): Promise<{ id: string; readAt: Date | null } | null> {
  return prisma.notification.findFirst({
    where: { id: notificationId, userId },
    select: { id: true, readAt: true },
  });
}

export async function markAsRead(notificationId: string): Promise<void> {
  await prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
}

export async function markAllAsRead(userId: string): Promise<void> {
  // Solo las que el usuario puede llegar a ver: dejar marcadas las de un espacio desactivado haria
  // que el contador no cuadrase si el espacio vuelve.
  await prisma.notification.updateMany({
    where: { ...reachableBy(userId), readAt: null },
    data: { readAt: new Date() },
  });
}
