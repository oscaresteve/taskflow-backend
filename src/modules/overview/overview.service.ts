import * as overviewRepository from "./overview.repository.ts";
import * as authorizationService from "../../shared/auth/authorization.service.ts";
import type { OverviewGridQueryDto } from "./schemas/overview.schema.ts";

// LLamar al repository y realizar toda la lógica necesaria

export async function getMyOverview({ userId }: { userId: string }) {
  return overviewRepository.getMyOverview({ userId });
}

export async function getMyWorkspaces({ userId, query }: { userId: string; query: OverviewGridQueryDto }) {
  return overviewRepository.findMyWorkspaces({
    userId,
    page: query.page,
    limit: query.limit,
    search: query.search,
  });
}

export async function getWorkspaceOverview({ userId, workspaceSlug }: { userId: string; workspaceSlug: string }) {
  // Obtener el contexto (comprueba que el usuario es miembro activo)
  const { workspace } = await authorizationService.getWorkspaceContext({ userId, workspaceSlug });

  return overviewRepository.getWorkspaceOverview({ userId, workspaceId: workspace.id });
}

export async function getWorkspaceProjects({
  userId,
  workspaceSlug,
  query,
}: {
  userId: string;
  workspaceSlug: string;
  query: OverviewGridQueryDto;
}) {
  // Obtener el contexto (comprueba que el usuario es miembro activo)
  const { workspace } = await authorizationService.getWorkspaceContext({ userId, workspaceSlug });

  return overviewRepository.findWorkspaceProjects({
    userId,
    workspaceId: workspace.id,
    page: query.page,
    limit: query.limit,
    search: query.search,
  });
}

export async function getProjectOverview({
  userId,
  workspaceSlug,
  projectSlug,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
}) {
  // Obtener el contexto (comprueba que el usuario es miembro activo del proyecto)
  const { project } = await authorizationService.getProjectContext({ userId, workspaceSlug, projectSlug });

  return overviewRepository.getProjectOverview({ projectId: project.id });
}
