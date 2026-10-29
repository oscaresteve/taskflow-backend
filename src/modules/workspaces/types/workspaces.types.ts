import type { Workspace, WorkspaceRole } from "../../../shared/types/prisma.types.ts";
import type { UserSummaryRow } from "../../users/users.repository.ts";

// El espacio tal y como lo ve un usuario concreto: a los campos de la tabla se le suman los dos que
// dependen de quien pregunta. Los resuelve el service, nunca el repository, que no sabe quien mira.
//
// A diferencia de ProjectForViewer, `myRole` no es nulable: todos los caminos que devuelven un
// espacio exigen pertenencia ACTIVE, asi que siempre hay rol. Viene en el listado para que la
// pantalla de gestion no tenga que preguntarlo por fila, que es lo unico que funciona cuando el
// espacio esta desactivado: ahi /members/me ya responde 404.
export type WorkspaceForViewer = Workspace & {
  isFavorite: boolean;
  myRole: WorkspaceRole;
};

// La fila del listado de gestion: lo anterior mas los responsables que pinta la tabla. Solo la
// devuelve findAll — el resto de caminos no los necesita, y el listado tiene que bastarse a si mismo
// porque de un espacio desactivado no se puede preguntar nada mas.
export type WorkspaceListItem = WorkspaceForViewer & {
  owners: UserSummaryRow[];
};
