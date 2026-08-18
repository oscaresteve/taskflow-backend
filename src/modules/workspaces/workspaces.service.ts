import * as workspacesRepository from "./workspaces.repository.ts";
import type { CreateWorkspaceDto, UpdateWorkspaceDto, WorkspaceQueryDto } from "./schemas/workspaces.schema.ts";
import { type Project, type User, type Workspace, type WorkspaceMember } from "../../shared/types/prisma.types.ts";
import generateUniqueSlug from "../../shared/utils/generate-unique-slug.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import { ConflictError } from "../../shared/errors/conflict-error.ts";
import * as authorizationService from "../../shared/auth/authorization.service.ts";
import { requireWorkspaceManager } from "../../shared/auth/permissions.ts";

// LLamar al repository y realizar toda la lógica necesaria

export async function create({ data, userId }: { data: CreateWorkspaceDto; userId: string }): Promise<Workspace> {
  const text = data.name;
  const exists = workspacesRepository.existsBySlug;

  const slug = await generateUniqueSlug({ text, exists }); // Generar el slug unico

  const workspace = await workspacesRepository.create({
    data,
    slug,
    userId,
  });

  return workspace;
}

export async function findAll({
  userId,
  query,
}: {
  userId: string;
  query: WorkspaceQueryDto;
}): Promise<PaginatedResult<Workspace>> {
  const workspaces = await workspacesRepository.findAllByUserId({ query, userId });

  return workspaces;
}

export async function findBySlug({
  userId,
  workspaceSlug,
}: {
  userId: string;
  workspaceSlug: string;
}): Promise<{ workspace: Workspace; projects: Project[]; members: (WorkspaceMember & { user: User })[] }> {
  // Obterner contexto
  const { workspace } = await authorizationService.getWorkspaceContext({ userId, workspaceSlug });

  // Incluir los proyectos activos y los miembros activos del workspace
  const [projects, members] = await Promise.all([
    workspacesRepository.findProjectsByWorkspaceId(workspace.id),
    workspacesRepository.findActiveMembersByWorkspaceId(workspace.id),
  ]);

  return { workspace, projects, members };
}

export async function update({
  userId,
  workspaceSlug,
  data,
}: {
  userId: string;
  workspaceSlug: string;
  data: UpdateWorkspaceDto;
}): Promise<Workspace> {
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

  const updatedWorkspace = await workspacesRepository.update({
    workspaceId: workspace.id,
    data: {
      ...data,
      slug: newSlug,
    },
  });

  return updatedWorkspace;
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
