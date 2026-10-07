import type { Prisma } from "../../prisma/generated/prisma/client.ts";
import type { ActivityAction } from "../../shared/types/prisma.types.ts";
import type { ActivityEventInput } from "./types/activity.types.ts";

// Las reglas de a quien afecta cada evento viven solo aqui. Si un dia molesta el ruido, esto es lo
// que un modelo de suscriptores explicitos ("seguir esta tarea") vendria a sustituir.

type TaskParties = {
  assigneeId: string | null;
  createdById: string;
};

// Las unicas acciones cuyos destinatarios dependen de quien esta en la tarea. El resto se resuelve
// con lo que ya trae el evento, asi que no hace falta releerla.
const ACTIONS_NEEDING_PARTIES: ActivityAction[] = [
  "COMMENT_CREATED",
  "TASK_STATUS_CHANGED",
  "TASK_DUE_DATE_CHANGED",
];

async function loadTaskParties(
  tx: Prisma.TransactionClient,
  events: ActivityEventInput[],
): Promise<Map<string, TaskParties>> {
  const taskIds = [
    ...new Set(
      events
        .filter((event) => ACTIONS_NEEDING_PARTIES.includes(event.action))
        .map((event) => event.taskId)
        .filter((taskId) => taskId !== null),
    ),
  ];

  if (taskIds.length === 0) return new Map();

  const tasks = await tx.task.findMany({
    where: { id: { in: taskIds } },
    select: { id: true, assigneeId: true, createdById: true },
  });

  return new Map(tasks.map((task) => [task.id, { assigneeId: task.assigneeId, createdById: task.createdById }]));
}

function recipientsFor(event: ActivityEventInput, taskParties: Map<string, TaskParties>): (string | null)[] {
  const parties = event.taskId ? taskParties.get(event.taskId) : undefined;

  switch (event.action) {
    case "COMMENT_CREATED":
      return [...event.payload.mentions, parties?.assigneeId ?? null, parties?.createdById ?? null];

    // El evento ya trae a quien avisar, asi que no depende de quien este en la tarea: mencionarte no
    // es asignarte.
    case "COMMENT_MENTIONED":
      return [...event.payload.mentions];

    case "TASK_ASSIGNEE_CHANGED":
      return [event.payload.to];

    case "TASK_STATUS_CHANGED":
      return [parties?.assigneeId ?? null, parties?.createdById ?? null];

    case "TASK_DUE_DATE_CHANGED":
      return [parties?.assigneeId ?? null];

    case "PROJECT_MEMBER_ADDED":
    case "WORKSPACE_MEMBER_INVITED":
      return [event.payload.targetUserId];

    // El resto va al historial, no a la campanita: un cambio de prioridad o un renombrado no
    // merecen interrumpir a nadie.
    default:
      return [];
  }
}

// Devuelve, alineados con los eventos que recibe, los destinatarios de cada uno.
export async function resolveRecipients(
  tx: Prisma.TransactionClient,
  events: ActivityEventInput[],
): Promise<string[][]> {
  const taskParties = await loadTaskParties(tx, events);

  return events.map((event) => {
    // Nadie se notifica a si mismo, y un mismo evento notifica una sola vez aunque te toque por
    // dos motivos (te mencionan y ademas eres el asignado).
    const recipients = new Set(
      recipientsFor(event, taskParties).filter(
        (userId): userId is string => userId !== null && userId !== event.actorId,
      ),
    );

    return [...recipients];
  });
}
