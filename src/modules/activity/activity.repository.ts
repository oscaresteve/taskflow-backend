import { prisma } from "../../config/prisma.ts";
import type { Prisma } from "../../prisma/generated/prisma/client.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import type { ActivityAction } from "../../shared/types/prisma.types.ts";
import type { ActivityEventInput, ActivityEventWithActor, ActivityPerson } from "./types/activity.types.ts";
import type { ActivityQueryDto } from "./schemas/activity.schema.ts";
import { resolveRecipients } from "./activity.recipients.ts";
import { toActivityEventResponse } from "./mappers/activity.mapper.ts";
import { emitActivityEvent, emitNotification } from "../../socket/realtime.ts";

// Recibe el cliente de la transaccion que abre la mutacion que origina los eventos: un evento que
// afirma algo que despues hizo rollback es peor que no tener evento. Las notificaciones se escriben
// aqui dentro por lo mismo: son filas, y tienen que aparecer y desaparecer con su evento.
//
// La emision por socket tambien sale de aqui, dentro de la transaccion. Es la opcion simple: las
// alternativas eran propagar los eventos hacia arriba por las 21 firmas que ya los reciben, o
// montar un buffer por peticion. Lo que se difunde por adelantado se autocorrige, porque el cliente
// invalida en vez de aplicar el payload; el limite conocido esta escrito en docs/eventos-de-dominio.md.
type CreatedEvent = Omit<ActivityEventWithActor, "target">;

export async function record(tx: Prisma.TransactionClient, events: ActivityEventInput[]): Promise<void> {
  // Una actualizacion puede no cambiar nada narrable (solo el titulo en blanco, el mismo estado...)
  if (events.length === 0) return;

  const recipientsByEvent = await resolveRecipients(tx, events);

  // Uno a uno y no con createMany porque hace falta el id de cada evento para colgarle sus
  // notificaciones, y el orden de vuelta de una insercion multiple no es algo que Prisma prometa.
  // En la practica casi todas las mutaciones emiten un solo evento, asi que es una consulta.
  const notifications: { userId: string; eventId: string }[] = [];
  const createdEvents: CreatedEvent[] = [];

  for (const [index, event] of events.entries()) {
    const created = await tx.activityEvent.create({
      data: {
        workspaceId: event.workspaceId,
        projectId: event.projectId,
        taskId: event.taskId,
        actorId: event.actorId,
        action: event.action,
        payload: event.payload,
      },
      include: {
        actor: { select: personSelect },
        project: { select: projectSelect },
      },
    });

    createdEvents.push(created);

    for (const userId of recipientsByEvent[index]) {
      notifications.push({ userId, eventId: created.id });
    }
  }

  if (notifications.length > 0) {
    await tx.notification.createMany({ data: notifications });
  }

  await broadcast(tx, createdEvents, recipientsByEvent);
}

// Un fallo del canal en vivo no puede tumbar una escritura que ya fue bien, y al emitir desde dentro
// de la transaccion podria: de ahi el try/catch que envuelve todo.
async function broadcast(
  tx: Prisma.TransactionClient,
  createdEvents: CreatedEvent[],
  recipientsByEvent: string[][],
): Promise<void> {
  try {
    const events = await attachTargets(createdEvents, tx);

    events.forEach((event, index) => {
      const dto = toActivityEventResponse(event);

      // Los eventos del propio espacio no cuelgan de un proyecto, asi que no tienen sala; el feed
      // de espacio no se actualiza en vivo.
      if (dto && event.projectId) {
        emitActivityEvent(event.projectId, { actorId: event.actor.id, event: dto });
      }

      for (const userId of recipientsByEvent[index]) {
        emitNotification(userId, { actorId: event.actor.id });
      }
    });
  } catch {
    // Silencio a proposito: el historial y la campanita ya estan escritos, y el cliente los vera en
    // su siguiente lectura.
  }
}

export const personSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  avatarUrl: true,
} as const;

export const projectSelect = {
  slug: true,
  key: true,
  name: true,
} as const;

// El id de la persona de la que habla el evento vive dentro del payload, asi que no hay join que
// lo traiga: se leen de una sola consulta para toda la pagina y se reparten.
export async function attachTargets<T extends { action: ActivityAction; payload: unknown }>(
  events: T[],
  client: Pick<Prisma.TransactionClient, "user"> = prisma,
): Promise<(T & { target: ActivityPerson | null })[]> {
  const targetIdByEvent = events.map((event) => targetUserIdOf(event.action, event.payload));
  const targetIds = [...new Set(targetIdByEvent.filter((id) => id !== null))];

  if (targetIds.length === 0) {
    return events.map((event) => ({ ...event, target: null }));
  }

  const people = await client.user.findMany({
    where: { id: { in: targetIds } },
    select: personSelect,
  });

  const peopleById = new Map(people.map((person) => [person.id, person]));

  return events.map((event, index) => {
    const targetId = targetIdByEvent[index];

    return { ...event, target: targetId ? (peopleById.get(targetId) ?? null) : null };
  });
}

// El payload todavia es Json sin parsear aqui; el mapper lo valida despues. Solo se mira el campo
// que identifica a la persona, y cada accion sabe cual es el suyo.
function targetUserIdOf(action: ActivityAction, payload: unknown): string | null {
  const fields = payload as { targetUserId?: unknown; to?: unknown };

  if (action === "TASK_ASSIGNEE_CHANGED") {
    return typeof fields.to === "string" ? fields.to : null;
  }

  return typeof fields.targetUserId === "string" ? fields.targetUserId : null;
}

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
          select: personSelect,
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
    items: await attachTargets(items),
    total,
  };
}

// Lo que un usuario puede ver del registro: lo del propio espacio mas lo de los proyectos de los
// que es miembro. Es el mismo alcance que aplican los contadores del overview, y lo comparten el
// feed de espacio y la campanita. No excluye los proyectos archivados, porque "archivo el proyecto
// X" es justo una de las entradas que interesan.
export function reachableEventsBy(userId: string): Prisma.ActivityEventWhereInput {
  return {
    workspace: { isActive: true },
    OR: [{ projectId: null }, { project: { members: { some: { userId, isActive: true } } } }],
  };
}

// Cada feed ensena su nivel y el de abajo, pero no dos niveles abajo: el del espacio habla del
// espacio y de sus proyectos, y el detalle de cada tarea se queda en el feed de su proyecto. Sin
// ese corte, un solo proyecto movido ahoga a todos los demas.
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
    where: { ...reachableEventsBy(userId), workspaceId, taskId: null },
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
