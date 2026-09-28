import type { ActivityAction } from "../../../shared/types/prisma.types.ts";
import type { ActivityPayloadMap, ActivityPerson } from "../types/activity.types.ts";

export type ActivityProjectDto = {
  slug: string;
  key: string;
  name: string;
};

export type ActivityPersonDto = ActivityPerson;

// Union discriminada por accion, igual que al escribir: el consumidor estrecha por action y sabe
// exactamente que campos tiene el payload, sin comprobaciones a mano.
export type ActivityEventResponseDto = {
  [A in ActivityAction]: {
    id: string;

    action: A;
    payload: ActivityPayloadMap[A];

    taskId: string | null;
    project: ActivityProjectDto | null;

    actor: ActivityPersonDto;
    // Solo las acciones que hablan de alguien lo traen ("asigno la tarea a X").
    target: ActivityPersonDto | null;

    createdAt: Date;
  };
}[ActivityAction];
