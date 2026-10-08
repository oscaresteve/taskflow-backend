import { randomUUID } from "node:crypto";
import * as workspacesRepository from "./workspaces.repository.ts";
import {
  AVATAR_EXTENSION_BY_CONTENT_TYPE,
  MAX_AVATAR_SIZE_BYTES,
  type AvatarUploadUrlDto,
  type ConfirmAvatarDto,
  type CreateWorkspaceDto,
  type UpdateWorkspaceDto,
  type WorkspaceQueryDto,
} from "./schemas/workspaces.schema.ts";
import { type Workspace } from "../../shared/types/prisma.types.ts";
import generateUniqueSlug from "../../shared/utils/generate-unique-slug.ts";
import retryOnUniqueViolation from "../../shared/utils/retry-on-unique-violation.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import { ConflictError } from "../../shared/errors/conflict-error.ts";
import { NotFoundError } from "../../shared/errors/not-found-error.ts";
import { BadRequestError } from "../../shared/errors/bad-request-error.ts";
import * as authorizationService from "../../shared/auth/authorization.service.ts";
import { requireWorkspaceManager } from "../../shared/auth/permissions.ts";
import { deleteObject, getUploadUrl, headObject } from "../../shared/storage/storage.service.ts";
import type { ActivityEventInput, WorkspaceEditedField } from "../activity/types/activity.types.ts";

// LLamar al repository y realizar toda la lógica necesaria

function buildWorkspaceUpdatedEvents({
  workspace,
  actorId,
  fields,
}: {
  workspace: Workspace;
  actorId: string;
  fields: WorkspaceEditedField[];
}): ActivityEventInput[] {
  if (fields.length === 0) return [];

  return [
    {
      workspaceId: workspace.id,
      projectId: null,
      taskId: null,
      actorId,
      action: "WORKSPACE_UPDATED",
      payload: { workspaceName: workspace.name, fields },
    },
  ];
}

export async function create({
  data,
  userId,
}: {
  data: CreateWorkspaceDto;
  userId: string;
}): Promise<Workspace & { isFavorite: boolean }> {
  const text = data.name;
  const exists = workspacesRepository.existsBySlug;

  const workspace = await retryOnUniqueViolation(async () => {
    const slug = await generateUniqueSlug({ text, exists }); // Generar el slug unico

    return workspacesRepository.create({
      data,
      slug,
      userId,
    });
  });

  // Un workspace recien creado no puede estar marcado como favorito todavia
  return { ...workspace, isFavorite: false };
}

export async function findAll({
  userId,
  query,
}: {
  userId: string;
  query: WorkspaceQueryDto;
}): Promise<PaginatedResult<Workspace & { isFavorite: boolean }>> {
  const workspaces = await workspacesRepository.findAllByUserId({ query, userId });

  const favoritedIds = await workspacesRepository.findFavoritedIds({
    userId,
    workspaceIds: workspaces.items.map((workspace) => workspace.id),
  });

  return {
    items: workspaces.items.map((workspace) => ({ ...workspace, isFavorite: favoritedIds.has(workspace.id) })),
    total: workspaces.total,
  };
}

export async function findBySlug({
  userId,
  workspaceSlug,
}: {
  userId: string;
  workspaceSlug: string;
}): Promise<Workspace & { isFavorite: boolean }> {
  // Obterner contexto
  const { workspace } = await authorizationService.getWorkspaceContext({ userId, workspaceSlug });

  const isFavorite = await workspacesRepository.isFavorited({ userId, workspaceId: workspace.id });

  return { ...workspace, isFavorite };
}

export async function favorite({ userId, workspaceSlug }: { userId: string; workspaceSlug: string }): Promise<void> {
  // Obterner contexto
  const { workspace } = await authorizationService.getWorkspaceContext({ userId, workspaceSlug });

  // Comprobar que no este ya marcado como favorito
  if (await workspacesRepository.isFavorited({ userId, workspaceId: workspace.id })) {
    throw new ConflictError("Workspace is already favorited");
  }

  await workspacesRepository.createFavorite({ userId, workspaceId: workspace.id });
}

export async function unfavorite({ userId, workspaceSlug }: { userId: string; workspaceSlug: string }): Promise<void> {
  // Obterner contexto
  const { workspace } = await authorizationService.getWorkspaceContext({ userId, workspaceSlug });

  // Comprobar que este marcado como favorito
  if (!(await workspacesRepository.isFavorited({ userId, workspaceId: workspace.id }))) {
    throw new NotFoundError("Workspace is not favorited");
  }

  await workspacesRepository.deleteFavorite({ userId, workspaceId: workspace.id });
}

export async function update({
  userId,
  workspaceSlug,
  data,
}: {
  userId: string;
  workspaceSlug: string;
  data: UpdateWorkspaceDto;
}): Promise<Workspace & { isFavorite: boolean }> {
  // Obterner contexto
  const { workspace, workspaceMember } = await authorizationService.getWorkspaceContext({
    userId,
    workspaceSlug,
  });

  // Comprobar permisos
  requireWorkspaceManager(workspaceMember);

  // Si el nombre cambia generar un nuevo slug
  let newSlug = workspace.slug;

  if (data.name && data.name !== workspace.name) {
    newSlug = await generateUniqueSlug({
      currentSlug: workspace.slug,
      text: data.name,
      exists: workspacesRepository.existsBySlug,
    });
  }

  // Nombre y descripcion comparten un unico evento que solo registra cuales cambiaron.
  const fields: WorkspaceEditedField[] = [];

  if (data.name !== undefined && data.name !== workspace.name) fields.push("name");
  if (data.description !== undefined && (data.description ?? null) !== workspace.description) {
    fields.push("description");
  }

  const events = buildWorkspaceUpdatedEvents({
    workspace: { ...workspace, name: data.name ?? workspace.name },
    actorId: userId,
    fields,
  });

  const [updatedWorkspace, isFavorite] = await Promise.all([
    workspacesRepository.update({
      workspaceId: workspace.id,
      data: {
        ...data,
        slug: newSlug,
      },
      events,
    }),
    workspacesRepository.isFavorited({ userId, workspaceId: workspace.id }),
  ]);

  return { ...updatedWorkspace, isFavorite };
}

export async function deactivate({ userId, workspaceSlug }: { userId: string; workspaceSlug: string }): Promise<void> {
  // Obterner contexto
  const { workspace, workspaceMember } = await authorizationService.getWorkspaceContext({
    userId,
    workspaceSlug,
  });

  // Comprobar permisos
  requireWorkspaceManager(workspaceMember);

  // Comprobar que no este ya desactivado
  if (workspace.isActive === false) throw new ConflictError("Workspace is already deactivated");

  await workspacesRepository.deactivate({
    workspaceId: workspace.id,
    events: [
      {
        workspaceId: workspace.id,
        projectId: null,
        taskId: null,
        actorId: userId,
        action: "WORKSPACE_DEACTIVATED",
        payload: { workspaceName: workspace.name },
      },
    ],
  });
}

export async function getAvatarUploadUrl({
  userId,
  workspaceSlug,
  data,
}: {
  userId: string;
  workspaceSlug: string;
  data: AvatarUploadUrlDto;
}): Promise<{ uploadUrl: string; key: string }> {
  // Obterner contexto
  const { workspace, workspaceMember } = await authorizationService.getWorkspaceContext({
    userId,
    workspaceSlug,
  });

  // Comprobar permisos
  requireWorkspaceManager(workspaceMember);

  // La key vive bajo el prefijo del workspace, así confirmAvatar puede comprobar que pertenece a este workspace
  const extension = AVATAR_EXTENSION_BY_CONTENT_TYPE[data.contentType];
  const key = `workspaces/${workspace.id}/avatar-${randomUUID()}.${extension}`;

  const uploadUrl = await getUploadUrl({ key, contentType: data.contentType, contentLength: data.fileSize });

  return { uploadUrl, key };
}

export async function confirmAvatar({
  userId,
  workspaceSlug,
  data,
}: {
  userId: string;
  workspaceSlug: string;
  data: ConfirmAvatarDto;
}): Promise<Workspace & { isFavorite: boolean }> {
  // Obterner contexto
  const { workspace, workspaceMember } = await authorizationService.getWorkspaceContext({
    userId,
    workspaceSlug,
  });

  // Comprobar permisos
  requireWorkspaceManager(workspaceMember);

  // La key debe ser una que nosotros mismos hayamos firmado para este workspace
  if (!data.key.startsWith(`workspaces/${workspace.id}/`)) {
    throw new BadRequestError("Invalid avatar key");
  }

  // No nos fiamos de lo que el cliente dijo que iba a subir: comprobamos el archivo real en el bucket
  const uploadedObject = await headObject({ key: data.key });
  if (!uploadedObject) {
    throw new BadRequestError("Avatar file was not uploaded");
  }

  const isValidContentType = uploadedObject.contentType && uploadedObject.contentType in AVATAR_EXTENSION_BY_CONTENT_TYPE;
  const isValidSize = uploadedObject.contentLength > 0 && uploadedObject.contentLength <= MAX_AVATAR_SIZE_BYTES;

  if (!isValidContentType || !isValidSize) {
    await deleteObject({ key: data.key });
    throw new BadRequestError("Uploaded file does not meet the avatar requirements");
  }

  // Si había un avatar anterior, lo borramos del bucket para no dejar objetos huérfanos
  if (workspace.avatarKey) {
    await deleteObject({ key: workspace.avatarKey });
  }

  const [updatedWorkspace, isFavorite] = await Promise.all([
    workspacesRepository.updateAvatarKey({
      workspaceId: workspace.id,
      avatarKey: data.key,
      events: buildWorkspaceUpdatedEvents({ workspace, actorId: userId, fields: ["avatar"] }),
    }),
    workspacesRepository.isFavorited({ userId, workspaceId: workspace.id }),
  ]);

  return { ...updatedWorkspace, isFavorite };
}

export async function deleteAvatar({
  userId,
  workspaceSlug,
}: {
  userId: string;
  workspaceSlug: string;
}): Promise<void> {
  // Obterner contexto
  const { workspace, workspaceMember } = await authorizationService.getWorkspaceContext({
    userId,
    workspaceSlug,
  });

  // Comprobar permisos
  requireWorkspaceManager(workspaceMember);

  if (!workspace.avatarKey) {
    throw new NotFoundError("Workspace has no avatar");
  }

  await deleteObject({ key: workspace.avatarKey });
  await workspacesRepository.updateAvatarKey({
    workspaceId: workspace.id,
    avatarKey: null,
    events: buildWorkspaceUpdatedEvents({ workspace, actorId: userId, fields: ["avatar"] }),
  });
}
