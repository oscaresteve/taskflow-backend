import * as authorizationService from "../../shared/auth/authorization.service.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import * as activityRepository from "./activity.repository.ts";
import type { ActivityQueryDto } from "./schemas/activity.schema.ts";
import type { ActivityEventWithActor } from "./types/activity.types.ts";

// Solo lectura: los eventos los escriben los modulos que originan el cambio, dentro de su propia
// transaccion, llamando a activityRepository.record.

export async function findAllByWorkspace({
  userId,
  workspaceSlug,
  query,
}: {
  userId: string;
  workspaceSlug: string;
  query: ActivityQueryDto;
}): Promise<PaginatedResult<ActivityEventWithActor>> {
  const { workspace } = await authorizationService.getWorkspaceContext({ userId, workspaceSlug });

  return activityRepository.findAllByWorkspace({ workspaceId: workspace.id, userId, query });
}

export async function findAllByProject({
  userId,
  workspaceSlug,
  projectSlug,
  query,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
  query: ActivityQueryDto;
}): Promise<PaginatedResult<ActivityEventWithActor>> {
  const { project } = await authorizationService.getProjectContext({ userId, workspaceSlug, projectSlug });

  return activityRepository.findAllByProject({ projectId: project.id, query });
}

export async function findAllByTask({
  userId,
  workspaceSlug,
  projectSlug,
  taskNumber,
  query,
}: {
  userId: string;
  workspaceSlug: string;
  projectSlug: string;
  taskNumber: number;
  query: ActivityQueryDto;
}): Promise<PaginatedResult<ActivityEventWithActor>> {
  const { task } = await authorizationService.getTaskContext({ userId, workspaceSlug, projectSlug, taskNumber });

  return activityRepository.findAllByTask({ taskId: task.id, query });
}
