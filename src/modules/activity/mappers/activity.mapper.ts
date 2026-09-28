import type { PaginatedResponseDto } from "../../../shared/dtos/pagination.dto.ts";
import type { PaginatedResult } from "../../../shared/types/pagination.types.ts";
import type { ActivityEventResponseDto } from "../dtos/activity.dto.ts";
import { activityPayloadSchemas } from "../schemas/activity.schema.ts";
import type { ActivityEventWithActor } from "../types/activity.types.ts";

// Devuelve null si el payload no encaja con su accion. Es la unica salida del Json de la base de
// datos, y un evento suelto mal formado no debe tumbar el feed entero.
function toActivityEventResponse(event: ActivityEventWithActor): ActivityEventResponseDto | null {
  const parsed = activityPayloadSchemas[event.action].safeParse(event.payload);

  if (!parsed.success) return null;

  return {
    id: event.id,

    action: event.action,
    // TypeScript no correlaciona la accion con su esquema al indexar el mapa, pero safeParse ya
    // garantizo que el payload es el de esta accion.
    payload: parsed.data,

    taskId: event.taskId,
    project: event.project,

    actor: {
      id: event.actor.id,
      firstName: event.actor.firstName,
      lastName: event.actor.lastName,
      avatarUrl: event.actor.avatarUrl,
    },

    createdAt: event.createdAt,
  } as ActivityEventResponseDto;
}

export function toActivityEventResponseDtoList(events: ActivityEventWithActor[]): ActivityEventResponseDto[] {
  return events.map(toActivityEventResponse).filter((event) => event !== null);
}

export function toPaginatedActivityEventResponseDto({
  events,
  page,
  limit,
}: {
  events: PaginatedResult<ActivityEventWithActor>;
  page: number;
  limit: number;
}): PaginatedResponseDto<ActivityEventResponseDto> {
  return {
    data: toActivityEventResponseDtoList(events.items),

    pagination: {
      page,
      limit,
      total: events.total,
      pages: Math.ceil(events.total / limit),
    },
  };
}
