import * as workspacesRepository from "./workspaces.repository.ts";
import type { CreateWorkspaceDto, UpdateWorkspaceDto, WorkspaceQueryDto } from "./schemas/workspaces.schema.ts";
import { type Workspace } from "../../shared/types/prisma.types.ts";
import generateUniqueSlug from "../../shared/utils/generate-unique-slug.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import { ConflictError } from "../../shared/errors/conflict-error.ts";
import { NotFoundError } from "../../shared/errors/not-found-error.ts";
import * as authorizationService from "../../shared/auth/authorization.service.ts";
import { requireWorkspaceManager } from "../../shared/auth/permissions.ts";

// LLamar al repository y realizar toda la lógica necesaria

export async function create({
  data,
  userId,
}: {
  data: CreateWorkspaceDto;
  userId: string;
}): Promise<Workspace & { isFavorite: boolean }> {
  const text = data.name;
  const exists = workspacesRepository.existsBySlug;

  const slug = await generateUniqueSlug({ text, exists }); // Generar el slug unico

  const workspace = await workspacesRepository.create({
    data,
    slug,
    userId,
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
      text: data.name,
      exists: workspacesRepository.existsBySlug,
    });
  }

  const [updatedWorkspace, isFavorite] = await Promise.all([
    workspacesRepository.update({
      workspaceId: workspace.id,
      data: {
        ...data,
        slug: newSlug,
      },
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

  await workspacesRepository.deactivate(workspace.id);
}
