import z from "zod";
import type { ActivityAction } from "../../../shared/types/prisma.types.ts";
import {
  activityPayloadSchemas,
  projectEditedFields,
  taskEditedFields,
  workspaceEditedFields,
} from "../schemas/activity.schema.ts";

// La forma de cada payload la declara su esquema zod, que es quien la valida al leer. El tipo se
// deriva de ahi para no mantener la misma tabla dos veces.
export type ActivityPayloadMap = {
  [A in ActivityAction]: z.infer<(typeof activityPayloadSchemas)[A]>;
};

export type TaskEditedField = (typeof taskEditedFields)[number];
export type ProjectEditedField = (typeof projectEditedFields)[number];
export type WorkspaceEditedField = (typeof workspaceEditedFields)[number];

// Union discriminada por accion: el payload que se pasa tiene que ser el de esa accion y no otro.
export type ActivityEventInput = {
  [A in ActivityAction]: {
    action: A;
    workspaceId: string;
    projectId: string | null;
    taskId: string | null;
    actorId: string;
    payload: ActivityPayloadMap[A];
  };
}[ActivityAction];

// Ni el actor ni la persona de la que habla el evento viven en el payload: se resuelven al leer
// para que el feed muestre siempre el nombre y el username actuales.
export type ActivityPerson = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  avatarUrl: string | null;
};

export type ActivityEventWithActor = {
  id: string;
  workspaceId: string;
  projectId: string | null;
  taskId: string | null;
  action: ActivityAction;
  payload: unknown;
  createdAt: Date;
  actor: ActivityPerson;
  // El feed de espacio mezcla proyectos, asi que cada entrada tiene que saber enlazar al suyo. El
  // slug se resuelve al leer y no desde el payload porque renombrar un proyecto lo cambia.
  project: {
    slug: string;
    key: string;
    name: string;
  } | null;
  // Solo las acciones que hablan de alguien lo traen ("asigno la tarea a X").
  target: ActivityPerson | null;
};
