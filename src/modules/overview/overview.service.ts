import * as overviewRepository from "./overview.repository.ts";
import * as authorizationService from "../../shared/auth/authorization.service.ts";

// LLamar al repository y realizar toda la lógica necesaria

export async function getMyOverview({ userId }: { userId: string }) {
  return overviewRepository.getMyOverview({ userId });
}

export async function getWorkspaceOverview({ userId, workspaceSlug }: { userId: string; workspaceSlug: string }) {
  // Obtener el contexto (comprueba que el usuario es miembro activo)
  const { workspace } = await authorizationService.getWorkspaceContext({ userId, workspaceSlug });

  return overviewRepository.getWorkspaceOverview({ workspaceId: workspace.id });
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
