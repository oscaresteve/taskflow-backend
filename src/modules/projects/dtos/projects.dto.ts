import type { UserSummaryResponseDto } from "../../users/dtos/users.dto.ts";
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

// La fila del listado de gestion. Los responsables vienen aqui y no se preguntan por fila porque de
// un proyecto archivado el listado de miembros responde 404: sin esto la columna quedaria vacia
// justo en la pestana donde hace falta decidir si desarchivarlo.
export type ProjectListItemResponseDto = ProjectResponseDto & {
  owners: UserSummaryResponseDto[];
};
