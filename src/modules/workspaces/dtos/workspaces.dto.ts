import type { WorkspaceRole } from "../../../shared/types/prisma.types.ts";
import type { UserSummaryResponseDto } from "../../users/dtos/users.dto.ts";

export type WorkspaceResponseDto = {
  id: string;

  name: string;
  slug: string;

  description: string | null;
  avatarUrl: string | null;

  isActive: boolean;
  isFavorite: boolean;

  // Mi rol en el espacio, que viene tambien en el listado para no preguntarlo por fila. Nunca es
  // null: todo camino que devuelve un espacio exige pertenencia ACTIVE.
  myRole: WorkspaceRole;

  createdAt: Date;
  updatedAt: Date;
};

// La fila del listado de gestion. Los responsables vienen aqui y no se preguntan por fila porque de
// un espacio desactivado el listado de miembros responde 404: sin esto la columna quedaria vacia
// justo en la pestana donde hace falta decidir si reactivarlo.
export type WorkspaceListItemResponseDto = WorkspaceResponseDto & {
  owners: UserSummaryResponseDto[];
};
