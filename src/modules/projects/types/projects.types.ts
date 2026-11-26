import type { Project, ProjectRole } from "../../../shared/types/prisma.types.ts";
import type { UserSummaryRow } from "../../users/users.repository.ts";

// El proyecto tal y como lo ve un usuario concreto: a los campos de la tabla se le suman los dos que
// dependen de quien pregunta. Los resuelve el service, nunca el repository, que no sabe quien mira.
//
// `myRole` es null cuando quien mira no es miembro activo del proyecto, que es el caso de un manager
// del espacio administrandolo desde fuera: su mando viene del rol de espacio, no de uno de proyecto
// (ver requireWorkspaceOrProjectManager). Una pertenencia desactivada cuenta como ausente, porque
// tampoco da mando.
export type ProjectForViewer = Project & {
  isFavorite: boolean;
  myRole: ProjectRole | null;
};

// La fila del listado de gestion: lo anterior mas los responsables que pinta la tabla. Solo la
// devuelve findAll, y el listado tiene que bastarse a si mismo porque de un proyecto archivado no se
// puede preguntar nada mas.
export type ProjectListItem = ProjectForViewer & {
  owners: UserSummaryRow[];
};
