import { prisma } from "../../config/prisma.ts";
import type { Prisma } from "../../prisma/generated/prisma/client.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { ActivityEventInput, ActivityEventWithActor } from "./types/activity.types.ts";
import type { ActivityQueryDto } from "./schemas/activity.schema.ts";

// Recibe el cliente de la transaccion que abre la mutacion que origina los eventos: un evento que
// afirma algo que despues hizo rollback es peor que no tener evento.
export async function record(tx: Prisma.TransactionClient, events: ActivityEventInput[]): Promise<void> {
  // Una actualizacion puede no cambiar nada narrable (solo el titulo en blanco, el mismo estado...)
  if (events.length === 0) return;

  await tx.activityEvent.createMany({
    data: events.map((event) => ({
      workspaceId: event.workspaceId,
      projectId: event.projectId,
      taskId: event.taskId,
      actorId: event.actorId,
      action: event.action,
      payload: event.payload,
    })),
  });
}

const actorSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
} as const;

const projectSelect = {
  slug: true,
  key: true,
  name: true,
} as const;

async function findAll({
  where,
  query,
}: {
  where: Prisma.ActivityEventWhereInput;
  query: ActivityQueryDto;
}): Promise<PaginatedResult<ActivityEventWithActor>> {
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.activityEvent.findMany({
      where,
      // El desempate por id mantiene estable la paginacion cuando varios eventos comparten
      // instante, que es lo normal: un solo update emite varios a la vez.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: query.limit,
      include: {
        actor: {
          select: actorSelect,
        },
        project: {
          select: projectSelect,
        },
      },
    }),

    prisma.activityEvent.count({
      where,
    }),
  ]);

  return {
    items,
    total,
  };
}

// El feed de espacio ensena lo del propio espacio mas lo de los proyectos de los que el usuario
// es miembro: la misma regla de alcance que ya aplican los contadores del overview. No excluye los
// proyectos archivados, porque "archivo el proyecto X" es justo una de las entradas que interesan.
export async function findAllByWorkspace({
  workspaceId,
  userId,
  query,
}: {
  workspaceId: string;
  userId: string;
  query: ActivityQueryDto;
}): Promise<PaginatedResult<ActivityEventWithActor>> {
  return findAll({
    where: {
      workspaceId,
      OR: [{ projectId: null }, { project: { members: { some: { userId, isActive: true } } } }],
    },
    query,
  });
}

export async function findAllByProject({
  projectId,
  query,
}: {
  projectId: string;
  query: ActivityQueryDto;
}): Promise<PaginatedResult<ActivityEventWithActor>> {
  return findAll({ where: { projectId }, query });
}

export async function findAllByTask({
  taskId,
  query,
}: {
  taskId: string;
  query: ActivityQueryDto;
}): Promise<PaginatedResult<ActivityEventWithActor>> {
  return findAll({ where: { taskId }, query });
}
