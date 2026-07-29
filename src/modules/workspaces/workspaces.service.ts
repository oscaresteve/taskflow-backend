import * as workspacesRepository from "./workspaces.repository.ts";
import type { CreateWorkspaceDto, UpdateWorkspaceDto, WorkspacesQueryDto } from "./schemas/workspaces.schema.ts";
import { WorkspaceRole, type Workspace } from "./types/workspaces.types.ts";
import generateUniqueSlug from "../../shared/utils/generate-unique-slug.ts";
import type { PaginatedResult } from "../../shared/types/pagination.types.ts";
import { NotFoundError } from "../../shared/errors/not-found-error.ts";
import { ForbiddenError } from "../../shared/errors/forbidden-error.ts";

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
  query: WorkspacesQueryDto;
}): Promise<PaginatedResult<Workspace>> {
  const workspaces = await workspacesRepository.findAllByUserId({ query, userId });

  return workspaces;
}

export async function findBySlug({ userId, slug }: { userId: string; slug: string }): Promise<Workspace> {
  const workspace = await workspacesRepository.findBySlug(slug);

  if (!workspace) throw new NotFoundError("Workspace not found");

  // Revisar si es miembro del workspace

  const workspaceId = workspace.id;

  const workspaceMeber = await workspacesRepository.findWorkspaceMember({ userId, workspaceId });

  if (!workspaceMeber) throw new ForbiddenError("You are not a member of this workspace");

  return workspace;
}

export async function update({
  userId,
  slug,
  data,
}: {
  userId: string;
  slug: string;
  data: UpdateWorkspaceDto;
}): Promise<Workspace> {
  const workspace = await workspacesRepository.findBySlug(slug);

  if (!workspace) throw new NotFoundError("Workspace not found");

  // Revisar si es miembro del workspace
  const workspaceId = workspace.id;

  const workspaceMember = await workspacesRepository.findWorkspaceMember({ userId, workspaceId });

  if (!workspaceMember) throw new ForbiddenError("You are not a member of this workspace");

  // Comprobar si es OWNER O ADMIN
  if (workspaceMember.role !== WorkspaceRole.OWNER && workspaceMember.role !== WorkspaceRole.ADMIN)
    throw new ForbiddenError("You have not permissions to edit this workspace");

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
