import { prisma } from "../../config/prisma.ts";
import { WorkspaceMemberStatus } from "../../shared/types/prisma.types.ts";
import { Prisma } from "../../prisma/generated/prisma/client.ts";
import type { Project, Task, Workspace } from "../../shared/types/prisma.types.ts";

// Solo comunicarse con el ORM o DB

export type SearchProjectRow = Project & {
  workspace: { slug: string; name: string };
};

export type SearchTaskRow = Task & {
  project: { key: string; slug: string; name: string; workspace: { slug: string; name: string } };
};

export type SearchRows = {
  workspaces: Workspace[];
  projects: SearchProjectRow[];
  tasks: SearchTaskRow[];
};

// Las mismas reglas de visibilidad que ya usan los overviews (overview.repository.ts): un espacio
// cuenta si esta activo y eres miembro ACTIVE, un proyecto si no esta archivado y eres miembro
// activo de el, y una tarea si no esta archivada y su proyecto cuenta. El buscador es global y no
// resuelve ningun slug, asi que estos predicados son lo unico que separa lo tuyo de lo ajeno: si
// no puedes abrirlo desde ninguna pantalla, tampoco puede salirte aqui.
function myWorkspaces(userId: string): Prisma.WorkspaceWhereInput {
  return { isActive: true, members: { some: { userId, status: WorkspaceMemberStatus.ACTIVE } } };
}

function myProjects(userId: string): Prisma.ProjectWhereInput {
  return { isArchived: false, members: { some: { userId, isActive: true } }, workspace: myWorkspaces(userId) };
}

function myTasks(userId: string): Prisma.TaskWhereInput {
  return { isArchived: false, project: myProjects(userId) };
}

// La visibilidad viaja en filtros de relacion anidados, asi que el OR del texto puede ocupar el
// nivel superior del where sin pisar nada.
function contains(search: string) {
  return { contains: search, mode: "insensitive" } as const;
}

// Sin indice de texto completo en el schema no hay relevancia que ordenar, asi que manda lo ultimo
// tocado: para cinco filas es el desempate mas util que tenemos.
const ORDER_BY_RECENT = { updatedAt: "desc" } as const;

export async function search({
  userId,
  search: query,
  limit,
}: {
  userId: string;
  search: string;
  limit: number;
}): Promise<SearchRows> {
  const [workspaces, projects, tasks] = await Promise.all([
    prisma.workspace.findMany({
      where: {
        ...myWorkspaces(userId),
        OR: [{ name: contains(query) }, { description: contains(query) }],
      },
      orderBy: ORDER_BY_RECENT,
      take: limit,
    }),

    prisma.project.findMany({
      where: {
        ...myProjects(userId),
        // La `key` entra en la busqueda porque es como el equipo llama al proyecto de viva voz.
        OR: [{ name: contains(query) }, { description: contains(query) }, { key: contains(query) }],
      },
      include: { workspace: { select: { slug: true, name: true } } },
      orderBy: ORDER_BY_RECENT,
      take: limit,
    }),

    prisma.task.findMany({
      where: {
        ...myTasks(userId),
        OR: [{ title: contains(query) }, { description: contains(query) }],
      },
      include: {
        project: {
          select: { key: true, slug: true, name: true, workspace: { select: { slug: true, name: true } } },
        },
      },
      orderBy: ORDER_BY_RECENT,
      take: limit,
    }),
  ]);

  return { workspaces, projects, tasks };
}
