import type { ProjectRole } from "../../../shared/types/prisma.types.ts";

export type ProjectResponseDto = {
  id: string;

  name: string;
  slug: string;
  key: string;

  description: string | null;
  color: string | null;

  isArchived: boolean;
  isFavorite: boolean;

  // El rol de quien pide, para que el cliente no tenga que preguntar por cada proyecto de una lista.
  myRole: ProjectRole | null;

  createdAt: Date;
  updatedAt: Date;
};
