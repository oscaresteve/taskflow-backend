import type { Project, ProjectRole } from "../../../shared/types/prisma.types.ts";

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
