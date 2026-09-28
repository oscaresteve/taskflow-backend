import type { ActivityAction } from "../../../shared/types/prisma.types.ts";
import type { ActivityPayloadMap } from "../types/activity.types.ts";

export type ActivityActorDto = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

// Union discriminada por accion, igual que al escribir: el consumidor estrecha por action y sabe
// exactamente que campos tiene el payload, sin comprobaciones a mano.
export type ActivityEventResponseDto = {
  [A in ActivityAction]: {
    id: string;

    action: A;
    payload: ActivityPayloadMap[A];

    taskId: string | null;

    actor: ActivityActorDto;

    createdAt: Date;
  };
}[ActivityAction];
