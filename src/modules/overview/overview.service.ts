import * as overviewRepository from "./overview.repository.ts";
import * as authorizationService from "../../shared/auth/authorization.service.ts";
import type { OverviewGridQueryDto } from "./schemas/overview.schema.ts";

// LLamar al repository y realizar toda la lógica necesaria

export async function getMyOverview({ userId, timeZone }: { userId: string; timeZone: string | null }) {
  return overviewRepository.getMyOverview({ userId, timeZone });
}

export async function getMyWorkspaces({
  userId,
  timeZone,
  query,
}: {
  userId: string;
  timeZone: string | null;
  query: OverviewGridQueryDto;
}) {
  return overviewRepository.findMyWorkspaces({
    userId,
    timeZone,
    page: query.page,
    limit: query.limit,
    search: query.search,
  });
}

export async function getWorkspaceOverview({
  userId,
  timeZone,
  workspaceSlug,
}: {
  userId: string;
  timeZone: string | null;
  workspaceSlug: string;
}) {
  // Obtener el contexto (comprueba que el usuario es miembro activo)
  const { workspace } = await authorizationService.getWorkspaceContext({ userId, workspaceSlug });

  return overviewRepository.getWorkspaceOverview({ userId, workspaceId: workspace.id, timeZone });
}

export async function getWorkspaceProjects({
  userId,
  timeZone,
  workspaceSlug,
  query,
}: {
  userId: string;
  timeZone: string | null;
  workspaceSlug: string;
  query: OverviewGridQueryDto;
}) {
  // Obtener el contexto (comprueba que el usuario es miembro activo)
  const { workspace } = await authorizationService.getWorkspaceContext({ userId, workspaceSlug });

  return overviewRepository.findWorkspaceProjects({
    userId,
    workspaceId: workspace.id,
    timeZone,
    page: query.page,
    limit: query.limit,
    search: query.search,
  });
}

export async function getProjectOverview({
  userId,
  timeZone,
  workspaceSlug,
  projectSlug,
}: {
  userId: string;
  timeZone: string | null;
  workspaceSlug: string;
  projectSlug: string;
}) {
  // Obtener el contexto (comprueba que el usuario es miembro activo del proyecto)
  const { project } = await authorizationService.getProjectContext({ userId, workspaceSlug, projectSlug });

  return overviewRepository.getProjectOverview({ projectId: project.id, timeZone });
}
